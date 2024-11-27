# shapka
to run in separate background shell:
fuser -k 8000/tcp
screen -d -m cargo run

to fix 502 from nginx - restart nginx with "sudo service nginx restart"

to set up ssl:
https://www.youtube.com/watch?v=uSm3xepvUNM&ab_channel=TonyTeachesTech

to start github runner in case it's dead:
cd actions-runner
screen -d -m ./run.sh

TODO:
- fix eventsteam not working over SSL
https://stackoverflow.com/questions/46371939/sse-over-https-not-working
https://stackoverflow.com/questions/59900466/server-sent-events-sse-problem-with-ssl-https
https://stackoverflow.com/questions/27898622/server-sent-events-stopped-work-after-enabling-ssl-on-proxy/27960243#27960243
might also be fixable with nginx config
go to /etc/nginx/sites-available, edit default and run sudo service nginx restart

Features:
- make it run as prod build
- delete games
- slider for words limit (maybe also random button)
- custom time limit
- maybe max players?
- num rounds for sure
- frond end improvements
    kick players
    teams menu is not very intuitive
- allow host to kick players
- generally fix players missing SSEs - fixed for start of game, not for switching turns, and ending game


BUGS:
- events are often missed - largest impact is people don't know when to start their turn - maybe refresh game state periodically?
- people lock their phones - while in game on a successful connection to the eventstream we need to refresh gamestate
- people randomly close the game - we need to store an active game id, player name and token on the client side and check on the home page if the player has an active game