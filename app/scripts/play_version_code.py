"""Print the versionCode the next Android release should use.

Play only offers an update to people whose installed versionCode is lower,
and permanently reserves every code it has accepted. The git commit count is
the default, but a bundle uploaded by hand (or with an overridden code) can
put Play ahead of it, and Play would then reject the upload ("does not allow
any existing users to upgrade"). Copied from Sharp's release tooling.

This takes the higher of the commit count and Play's highest code + 1. The
Play lookup is read-only: it opens a throwaway edit, reads every uploaded
bundle and APK and every track, and deletes the edit without committing.

Standard library only (the JWT is signed with the openssl CLI), so the
runner needs nothing installed. Credentials come from the
PLAY_SERVICE_ACCOUNT_JSON environment variable and are never printed.
"""

import base64
import json
import os
import subprocess
import sys
import tempfile
import time
import urllib.parse
import urllib.request

API = "https://androidpublisher.googleapis.com/androidpublisher/v3/applications"
SCOPE = "https://www.googleapis.com/auth/androidpublisher"


def next_version_code(commit_count, published_codes):
    """The next code: above everything Play has, and never below the count."""
    highest = max(published_codes, default=0)
    return max(commit_count, highest + 1)


def codes_from_responses(bundles, apks, tracks):
    """Every versionCode in the edit's bundles, APKs and track releases."""
    codes = [int(b["versionCode"]) for b in bundles.get("bundles", [])]
    codes += [int(a["versionCode"]) for a in apks.get("apks", [])]
    for track in tracks.get("tracks", []):
        for release in track.get("releases", []):
            codes += [int(code) for code in release.get("versionCodes", [])]
    return codes


def _b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _access_token(account):
    now = int(time.time())
    header = _b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = _b64url(json.dumps({
        "iss": account["client_email"],
        "scope": SCOPE,
        "aud": account["token_uri"],
        "iat": now,
        "exp": now + 600,
    }).encode())
    signing_input = f"{header}.{claims}".encode()
    # A private temp file the openssl CLI can read, removed straight after.
    fd, key_path = tempfile.mkstemp(dir=os.environ.get("RUNNER_TEMP"))
    try:
        with os.fdopen(fd, "w") as key_file:
            key_file.write(account["private_key"])
        signature = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", key_path],
            input=signing_input, capture_output=True, check=True,
        ).stdout
    finally:
        os.remove(key_path)
    assertion = f"{header}.{claims}.{_b64url(signature)}"
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": assertion,
    }).encode()
    with urllib.request.urlopen(account["token_uri"], data=body, timeout=30) as response:
        return json.load(response)["access_token"]


def published_version_codes(account, package):
    token = _access_token(account)
    base = f"{API}/{package}"

    def call(method, path):
        request = urllib.request.Request(
            base + path, method=method, data=b"" if method == "POST" else None,
            headers={"Authorization": f"Bearer {token}"},
        )
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}

    edit = call("POST", "/edits")["id"]
    try:
        return codes_from_responses(
            call("GET", f"/edits/{edit}/bundles"),
            call("GET", f"/edits/{edit}/apks"),
            call("GET", f"/edits/{edit}/tracks"),
        )
    finally:
        # Never committed: this edit only reads.
        call("DELETE", f"/edits/{edit}")


def main():
    if len(sys.argv) != 3:
        raise SystemExit("Usage: play_version_code.py PACKAGE COMMIT_COUNT")
    package, commit_count = sys.argv[1], int(sys.argv[2])
    raw = os.environ.get("PLAY_SERVICE_ACCOUNT_JSON", "")
    if not raw.strip():
        raise SystemExit("PLAY_SERVICE_ACCOUNT_JSON is not set")
    codes = published_version_codes(json.loads(raw), package)
    code = next_version_code(commit_count, codes)
    print(
        f"Play's highest versionCode: {max(codes, default=0)}; "
        f"commit count: {commit_count}; using {code}",
        file=sys.stderr,
    )
    print(code)


if __name__ == "__main__":
    main()
