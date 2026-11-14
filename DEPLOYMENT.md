# Deployment

The server runs on **Azure Container Apps** in **Poland Central**. Every merge
to `master` that touches the server deploys it
(`.github/workflows/container-app.yml`).

**URL:** https://shapka-server.agreeablebeach-1eae2480.polandcentral.azurecontainerapps.io
(the web client and the API are both served from here).

## Resources (`rg-shapka`, Poland Central)

| Resource | Name | Notes |
| --- | --- | --- |
| Container Apps environment | `shapka-env` | Consumption profile. No Log Analytics workspace (no log cost); see [Logs](#logs). |
| Container app | `shapka-server` | 0.25 vCPU / 0.5 GiB (the smallest size), external HTTPS ingress → port 8000, single revision mode. |
| Managed identity | `shapka-github-deploy` | GitHub Actions signs in as this (OIDC, no secrets). Federated only for `refs/heads/master`. Contributor on the container app only, plus read access to the environment. |
| Image | `ghcr.io/georgi-g-angelov/shapka` | Public GitHub package: free, pulled without credentials. |

The old VM in the `shapka` resource group and its manual `deploy.yml` workflow
are untouched.

## Scaling and what it means for games

- **Min 0 instances:** with no traffic the app scales to zero (about 5 minutes
  after the last request), costing nothing. The first request then waits for a
  cold start of a few seconds. During a game every phone holds a live-updates
  connection, which keeps the instance awake.
- **Max 2 instances, scaling at 200 concurrent requests per instance.** Games
  live in the server's memory and Azure's load balancer can't route by game,
  so with two instances a player can land on the one that doesn't know their
  game ("Game not found"). Azure's default threshold (10) would start a second
  instance at about one game of 6+ players, since each phone's live-updates
  connection counts. At 200, one instance serves roughly 30 simultaneous
  games, and a second only starts beyond that.
  To use more than one instance safely, game state needs to move out of
  memory (e.g. Redis).
- **Games are lost when the instance stops:** on a deploy, or when it scales
  to zero (only after everyone has disconnected for ~5 minutes).

## Cost

Consumption pricing with a monthly free grant per subscription (180,000
vCPU-seconds, 360,000 GiB-seconds, 2 million requests). At 0.25 vCPU, an
instance running 4 hours uses 3,600 vCPU-seconds, so typical use stays inside
the free grant. Scaled to zero, nothing is billed. The image registry (public
GitHub package) and logs (streaming only) are free.

## Rate limiting behind the ingress

All requests reach the container from Azure's proxy, so the rate limiter
(per client: 400 requests/min, 100 per endpoint) uses the address the proxy
appends to `X-Forwarded-For`. This is enabled by `SHAPKA_TRUST_FORWARDED_FOR=true`
in the image. Only set it behind a proxy that appends the client address,
because otherwise clients could choose their own. Verified in production:
requests with forged `X-Forwarded-For` values are still counted against the
real client address.

## Deploying

- **Automatically:** merging to `master` builds the image, pushes
  `ghcr.io/georgi-g-angelov/shapka:sha-<commit>` and `:latest`, rolls out a
  revision named `shapka-server--sha-<commit>` and checks the URL responds.
- **Manually:** Actions → *Container App* → *Run workflow* on `master`.
- **Pull requests** build the image (a Dockerfile check); same-repo PRs also
  push `sha-<merge commit>`, which can be deployed by hand to try a branch:

  ```sh
  az containerapp update -n shapka-server -g rg-shapka --image ghcr.io/georgi-g-angelov/shapka:sha-<tag>
  ```

- **Rollback:** deploy an earlier `sha-…` tag the same way.

The workflow reads these repository variables: `AZURE_CLIENT_ID`,
`AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP` (`rg-shapka`),
`AZURE_CONTAINER_APP` (`shapka-server`).

## Logs

```sh
az containerapp logs show -n shapka-server -g rg-shapka --follow   # live
az containerapp logs show -n shapka-server -g rg-shapka --tail 300
```

The rate limiter logs `Throttling <address>` once a minute per throttled
client.

## Running the image locally

```sh
docker build -t shapka .
docker run -p 8000:8000 -e SHAPKA_TRUST_FORWARDED_FOR=false shapka
```

## Recreating the infrastructure

```sh
az group create -n rg-shapka -l polandcentral
az containerapp env create -n shapka-env -g rg-shapka -l polandcentral --logs-destination none
az containerapp create -n shapka-server -g rg-shapka --environment shapka-env \
  --image ghcr.io/georgi-g-angelov/shapka:latest \
  --ingress external --target-port 8000 --cpu 0.25 --memory 0.5Gi \
  --min-replicas 0 --max-replicas 2 \
  --scale-rule-name http-concurrency --scale-rule-type http --scale-rule-http-concurrency 200
az identity create -n shapka-github-deploy -g rg-shapka
az identity federated-credential create --name github-master --identity-name shapka-github-deploy -g rg-shapka \
  --issuer https://token.actions.githubusercontent.com \
  --subject repo:Georgi-G-Angelov/shapka:ref:refs/heads/master --audiences api://AzureADTokenExchange
# Contributor on the container app, Container Apps ManagedEnvironments Reader on the environment.
# (Container Apps Contributor is not enough: it doesn't grant Microsoft.App/containerApps/write.)
```

A new environment gets a new URL; update the app's `SHAPKA_SERVER` accordingly.
