var tstamp = Math.round ((new Date ()).getTime () / 1000);

/*
var bsht = '<div style="position: relative; width: 200px; left: 40px; top: 4px;">Speed: '
           + '<select id="battle-speed">'
           + '  <option value="0">||</option>'
           + '  <option value="1" selected>1</option>'
           + '  <option value="3">3</option>'
           + '  <option value="5">5</option>'
           + '</select>'
           + '</div>';
*/

//<div class="modal-footer">     <button onclick=" openfullscreen ()" style="width: 100%; height: 100%;">full screen</button>   </div>
var bsft = '<div class="modal-footer" style="text-align:center;">'
         + 'Speed:'
         + '  <select id="battle-speed">'
         + '    <option value="0">||</option>'
         + '    <option value="1" selected="">1</option>'
         + '    <option value="3">3</option>'
         + '    <option value="5">5</option>'
         + '  </select>'
         + '  <button onclick="restartBattlesim ()" style="padding: 3px;">Restart</button>'
         + '  <span class="close" style="display:inline-block; float: right;"></span>'
         + '</div>';

var ht = '<link rel="stylesheet" type="text/css" href="https://static.nemexia.net/game/css/battle_style.css?' + tstamp + '"/>'
       + '<div id="myModal" class="modal" style="display:none;">'
       + '  <div class="sixteen-nine">'
       + '    <div class="content"><h1 style="width:100%;">Battle</h1>'
       + '      <div class="modal-content">'
       + bsft
       + '        <div class="modal-header">'
       + '          <div class="background_head"></div>'
       + '          <div class="attacker-title">'
       + '            <div id="myProgress_att">'
       + '              <div id="myBar_att" style="width: 100%; height: 100%;"><h2 id="at">Attacker</h2></div>'
       + '            </div>'
       + '          </div>'
       + '          <div class="defender-title">'
       + '            <div id="myProgress_def">'
       + '              <div id="myBar_def" style="width: 100%; height: 100%;"><h2 id="de">Defender</h2></div>'
       + '            </div>'
       + '          </div>'
       + '        </div>'
       + '        <div id="popupbody" class="modal-body">'
       + '          <div class="sixteen-nine">'
       + '            <div class="content">'
       + '              <canvas id="background"></canvas>'
       + '              <canvas id="ship"></canvas>'
       + '              <canvas id="main"></canvas>'
       + '              <canvas id="explosion"></canvas>'
       + '              <!-- div class="score">SCORE: <span id="score"></span></div -->'
       + '                <div class="game-over" id="game-over">'
       + '                  <div id="d"><div style="display: block; position: absolute; width: 50%; top: 41%;">'
       + '                    <div class="bp">-</div>'
       + '                    <div class="rp">-</div>'
       + '                  </div>'
       + '                </div>'
       + '                <!-- p><span onclick="game.restart()">Restart</span></p -->'
       + '              </div>'
       + '              <div class="loading" id="loading">Loading<p>Please Wait</p></div>'
       + '            </div>'
       + '          </div>'
       + '        </div>'
       + '      </div>'
       + '    </div>'
       + '  </div>'
       + '</div>';

$('body').prepend (ht);

var is_fullscreen = false;
//window.onload = openfullscreen ();

function launchIntoFullscreen(element) {
  if (element.requestFullscreen) {
    element.requestFullscreen ();
  } else if (element.mozRequestFullScreen) {
    element.mozRequestFullscreen ();
  } else if (element.webkitRequestFullscreen) {
    element.webkitRequestFullscreen ();
  } else if (element.msRequestFullscreen) {
    element.msRequestFullscreen ();
  }
}

function openfullscreen () {
  if (!is_fullscreen) {
    is_fullscreen = true;
    fix ();
    //launchIntoFullscreen(document.documentElement);
    var ele = document.getElementById ("myModal");

    launchIntoFullscreen(ele);
  } else {
    is_fullscreen = false;
    exitFullscreen ();
  }
}

function restartBattlesim () {
  game_restart ();
}

function exitFullscreen () {
  if (document.exitFullscreen) {
    document.exitFullscreen ();
  } else if (document.mozCancelFullScreen) {
    document.mozCancelFullscreen ();
  } else if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen ();
  }
  window.close();
}

function fix() {
  var screenhei = screen.height;
  var screenwidth = window.screen.availWidth;
  document.getElementById ('myModal').width = screenwidth;
  document.getElementById ('myModal').height = screenhei;
}

var modal = document.getElementById ('myModal');

// Get the button that opens the modal
var btn = document.getElementById ("myBtn");

// Get the <span> element that closes the modal
var span = document.getElementsByClassName("close")[0];

// When the user clicks the button, open the modal
var firstBtnClick = true;
btn.onclick = function() {

  if (firstBtnClick) {
    firstBtnClick = false;

    var b_js  = document.createElement("script");
    b_js.type = "text/javascript";
    b_js.src  = "battleReport.php?type=battlejs&" + location.search.replace ('?', '');
    b_js.async = false;
    b_js.onload = function () {
      if (typeof battlejs_ready !== 'undefined' && battlejs_ready === true) {
        modal.style.display = "block";
        var js = document.createElement("script");
        js.type = "text/javascript";
        js.src = "https://static.nemexia.net/game/js/battle.js?" + location.search.replace ('?', '');
        js.onload = function () {
          prepare_battle_init ();
          imageRepository_init ();
        }

        document.body.appendChild (js);
        document.getElementById ("de").innerHTML=defender_name;
        document.getElementById ("at").innerHTML=attacker_name;

        $("#battle-speed").change (function () { gameSpeed = parseInt ($(this).val ()) });

      }
    }
    document.body.appendChild (b_js);
  } else {
    if (battlejs_ready) {
      modal.style.display = "block";
      game_restart ();
    }
  }
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
  Game.gameOver ();
  console.log (prepare_battle);
}

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
    modal.style.display = "none";
  }
}
