var STATE = {
  connected: false,
}

//-------canvas code--------
var canvas, ctx, flag = false,
        prevX = 0,
        currX = 0,
        prevY = 0,
        currY = 0,
        dot_flag = false;

var x = "black",
    y = 2;

var path = "";

var whiteboard_id = ""

function color(obj) {
    switch (obj.id) {
        case "green":
            x = "green";
            break;
        case "blue":
            x = "blue";
            break;
        case "red":
            x = "red";
            break;
        case "yellow":
            x = "yellow";
            break;
        case "orange":
            x = "orange";
            break;
        case "black":
            x = "black";
            break;
        case "white":
            x = "white";
            break;
    }
    if (x == "white") y = 14;
    else y = 2;

}

function draw() {
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(currX, currY);
    ctx.strokeStyle = x;
    ctx.lineWidth = y;
    ctx.stroke();
    ctx.closePath();
}

function erase() {
    var m = confirm("Want to clear");
    if (m) {
        ctx.clearRect(0, 0, w, h);
        document.getElementById("canvasimg").style.display = "none";
    }
}

function save() {
    document.getElementById("canvasimg").style.border = "2px solid";
    var dataURL = canvas.toDataURL();
    document.getElementById("canvasimg").src = dataURL;
    document.getElementById("canvasimg").style.display = "inline";
}

function findxy(res, e) {
    if (res == 'down') {
        prevX = currX;
        prevY = currY;
        currX = e.clientX - canvas.offsetLeft;
        currY = e.clientY - canvas.offsetTop;

        flag = true;
        path = "";

        ctx.beginPath();
        ctx.fillStyle = x;
        ctx.fillRect(currX, currY, 2, 2);
    }
    if (res == 'up' || res == "out") {
        if (flag) {
          ctx.strokeStyle = x;
          ctx.lineWidth = y;

          var path2d = new Path2D(path);
            
          fetch("/message" + whiteboard_id, {
            method: "POST",
            body: new URLSearchParams({ username: 'username', message: path }),
          }).then((response) => {
          });
          

          ctx.stroke();


          ctx.closePath();
        }
        flag = false;
    }
    if (res == 'move') {
        if (flag) {
            prevX = currX;
            prevY = currY;
            currX = e.clientX - canvas.offsetLeft;
            currY = e.clientY - canvas.offsetTop;
            path += "M " + prevX + " " + prevY + " ";
            path += "L " + currX + " " + currY + " ";
            ctx.moveTo(prevX, prevY);
            ctx.lineTo(currX, currY);
            draw();
        }
    }
}


//----------- chat code-------------

// Subscribe to the event source at `uri` with exponential backoff reconnect.
function subscribe(uri) {
  var retryTime = 1;

  function connect(uri) {
    const events = new EventSource(uri);

    events.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (!"message" in msg || !"username" in msg) return;

      ctx.stroke(new Path2D(msg.message));
    });

    events.addEventListener("open", () => {
      setConnectedStatus(true);
      console.log(`connected to event stream at ${uri}`);
      retryTime = 1;
    });

    events.addEventListener("error", () => {
      setConnectedStatus(false);
      events.close();

      let timeout = retryTime;
      retryTime = Math.min(64, retryTime * 2);
      console.log(`connection lost. attempting to reconnect in ${timeout}s`);
      setTimeout(() => connect(uri), (() => timeout * 1000)());
    });
  }

  connect(uri);
}

// Set the connection status: `true` for connected, `false` for disconnected.
function setConnectedStatus(status) {
  STATE.connected = status;
}

// Let's go! Initialize the world.
function init() {
 
  // canvas stuff
  canvas = document.getElementById('can');
  ctx = canvas.getContext("2d");
  w = canvas.width;
  h = canvas.height;

  ctx.strokeStyle = x;
  ctx.lineWidth = y;

  canvas.addEventListener("mousemove", function (e) {
      findxy('move', e)
  }, false);
  canvas.addEventListener("mousedown", function (e) {
      findxy('down', e)
  }, false);
  canvas.addEventListener("mouseup", function (e) {
      findxy('up', e)
  }, false);
  canvas.addEventListener("mouseout", function (e) {
      findxy('out', e)
  }, false);


  var pathname = window.location.pathname;
  whiteboard_id = '/' + pathname.substring(pathname.lastIndexOf('/'))


  // Fetch current whiteboard state and draw everything
  fetch("/whiteboard_state" + whiteboard_id, {
    method: "GET",
  })
  .then(response => response.text())
  .then(data => {
    let commands = data.split(";");
    commands.forEach(command => {
      ctx.stroke(new Path2D(command));
    })
  });


  // Subscribe to server-sent events.
  subscribe("/events" + whiteboard_id);
}

