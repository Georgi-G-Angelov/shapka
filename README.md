# shapka
to run in separate background shell:
fuser -k 8000/tcp
screen -d -m cargo run

to set up ssl:
https://www.youtube.com/watch?v=uSm3xepvUNM&ab_channel=TonyTeachesTech

TODO:
- fix eventsteam not working over SSL
https://stackoverflow.com/questions/46371939/sse-over-https-not-working
https://stackoverflow.com/questions/59900466/server-sent-events-sse-problem-with-ssl-https
https://stackoverflow.com/questions/27898622/server-sent-events-stopped-work-after-enabling-ssl-on-proxy/27960243#27960243
might also be fixable with nginx config
go to /etc/nginx/sites-available, edit default and run sudo service nginx restart

Features:
- make it run as prod build
- undo guess word
- delete games
- slider for words limit (maybe also random button)
- custom time limit
- maybe max players?
- num rounds for sure
- frond end improvements
- allow host to kick players
- leave game is broken if player has added words
- generally fix players missing SSEs - fixed for start of game, not for switching turns, and ending game