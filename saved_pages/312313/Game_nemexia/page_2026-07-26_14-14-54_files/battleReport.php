<!DOCTYPE html>
<html prefix="og: http://ogp.me/ns# fb: http://ogp.me/ns/fb#">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, user-scalable=yes">
  <title>Nemexia</title>
  <meta name="author" content="2AXION" />
  <meta name="copyright" content="2AXION" />
  <link href='https://fonts.googleapis.com/css?family=Poppins:200,300,400,600,700' rel='stylesheet' type='text/css'>
  <link href="Fonts/fonts.css" rel="stylesheet" />
  <link rel="stylesheet" href="https://unpkg.com/flickity@2/dist/flickity.min.css">
  <link href="Fonts/fontawesome.min.css" rel="stylesheet" />
  <link href="Fonts/fa-regular.min.css" rel="stylesheet" />
  <!-- <link rel="icon" type="image/png" href="@Href("~/favicon.png")"> -->
  <link href="Content/Css/bootstrap.min.css" rel="stylesheet" />
  <link rel="stylesheet"
    href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.12.4/css/bootstrap-select.min.css">
  <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.3.1/css/all.css"
    integrity="sha384-mzrmE5qonljUremFsqc01SB46JvROS7bZs3IO2EmfFsd15uHvIt+Y8vEf7N7fWAU" crossorigin="anonymous">
  <link rel="stylesheet" href="https://necolas.github.io/normalize.css/8.0.0/normalize.css">

  <link href="Content/Css/Nemexia.css?1" rel="stylesheet" />
</head>

<body>
  <header>
    <div class="container">
      <div class="hud-header">
        <form id="login">
          <div class="row">
            <div class="col-xs-3">
              <div class="form-group">
                <label>SERVER</label>
                <select id="server" name="server" class="selectpicker" data-style="btn-dropdown">
                  <option value="ares">Ares (Western Europe)</option>
                  <option value="jarilo">Jarilo (Eastern Europe)</option>
                  <option value="horus">Horus (International)</option>
                  <option value="horus#2">Horus #2 (No Planet Kill, No Defense, x10)</option>
                  <option value="odin">Odin</option>
                  <option value="mask">Mask (Middle East)</option>
				  <!--
				  <option value="reward" selected>Reward (Who's The Boss)</option>
				  -->
				  <!--
                  <option value="americo#1">Americo (Test/Competition)</option>
                  <option value="americo#2">Americo (Multi-accounting; No Arena)</option>
                  <option value="mask">Mask (Protected Sleep 23:00-9:00)</option>
                  -->
                  <option disabled></option>
                  <option value="mobile">Nemexia App</option>
                  <option value="ragewar">Ragewar (New Game)</option>
                </select>
              </div>
              <!-- <div class="form-group">
                     <label class="secundary-color"> <input id="rememberme" name="rememberme" type="checkbox"> Remember-me</label>
                </div>
                -->
            </div>
            <div class="col-xs-3">
              <div class="form-group">
                <label>USERNAME</label>
                <input type="text" class="form-control" name="username" id="username">
              </div>
            </div>
            <div class="col-xs-3">
              <div class="form-group">
                <label>PASSWORD</label>
                <input type="password" class="form-control" name="password" id="password">
              </div>
              <div class="form-group">
                <a href="#" class="lostpass">Forgotten password?</a>
              </div>
            </div>
            <div class="col-xs-3">
              <button id="btn-login" type="submit" class="btn btn-success btn-block">LOGIN</button>
              <!-- <button id="btn-register" type="button" data-toggle="modal" data-target="#registerModal" class="btn btn-secundary btn-block"><b>REGISTER NOW</b><small>PLAY FOR FREE</small></button> -->
              <button id="btn-register2" type="button" class="btn btn-secundary btn-block"><b>REGISTER
                  NOW</b><small>PLAY FOR FREE</small></button>
            </div>
          </div>
        </form>
      </div>
    </div>
  </header>
  <main>
    <section class="fullvideoscreen">
      <!-- The video -->
      <video autoplay muted loop id="myVideo">
        <source src="Content/Videos/NMX_web2.mp4" type="video/mp4">
      </video>
      <div class="container text-center">
        <i class="far fa-play-circle"></i>
        <h1 class="text-center">The Evolution is over.
          <br>You’ve survived the Apocalypse and
        </h1>
        <h2>you’ve received your Redemption</span>
      </div>
      <div class="bg-maskvideo"></div>
      <div class="box-shadow"></div>
    </section>
    <section class="ranking">
      <div class="container">
        <div class="row">
          <div class="col-xs-12">
            <div class="servercontainer">

              <!-- RANKING TITLE -->
              <div class="servercontainer-header">
                <h3>RANKING</h2>
                  <h4>CHOOSE A SERVER
                </h3>
              </div>

              <!-- RANKING SERVER SELECT -->
              <div class="servercontainer-index">
                <ul class="servercontainer-index-list">
                  <li class="is-nav-selected" onclick="LoadRanking('ares');">
                    <img src="Content/images/icon-ares.svg" />
                  </li>
                  <li onclick="LoadRanking('jarilo');">
                    <img src="Content/images/icon-jarilo.svg" />
                  </li>
                  <li onclick="LoadRanking('horus');">
                    <img src="Content/images/icon-horus.svg" />
                  </li>
                  <li onclick="LoadRanking('odin');">
                    <img src="Content/images/icon-odin.svg" />
                  </li>
                </ul>
              </div>
              <div class="servercontainer-slider">
                <!-- RANKING SERVER SLIDER ITEM -->
                <div class="servercontainer-content">
                  <div id="server-americo" class="servercontainer-content-item">
                    <div class="server-ranking">
                      <h5 class="text-center">TOP COMMANDERS</h5>
                      <div class="server-ranking-top">
                        <li id="rnkTemplateCommanders" class="hidden">
                          <img src="Content/images/topcommanders-number{{commanderrank}}.png">
                          <div class="server-ranking-player">
                            <span class="server-ranking-player-name">{{commanderplayername}}</span>
                            <span class="server-ranking-player-server">{{commanderalliancename}}</span>
                            <span class="server-ranking-player-points">{{commanderpoint}}
                              <i>points</i>
                            </span>
                          </div>
                        </li>
                        <ul id="commandersRanking" class="">
                          <!-- RANKING SERVER SLIDER TOP 3 COMMANDERS ITENS -->



                        </ul>
                      </div>
                      <div class="server-ranking-geral">
                        <li id="rnkTemplateCommandersmini" class="hidden">
                          <span class="server-ranking-geral-posicao">{{commanderminirank}}</span>
                          <div class="server-ranking-player">
                            <span class="server-ranking-player-name">{{commanderminiplayername}}</span>
                            <span class="server-ranking-player-points">{{commanderminipoints}}
                              <i>points</i>
                            </span>
                          </div>
                        </li>

                        <ul id="commandersRankingmini" class="">
                          <!-- RANKING SERVER SLIDER GERAL COMMANDERS ITENS -->

                          <!--<li>
                <span class="server-ranking-geral-posicao">5</span>
                <div class="server-ranking-player">
                  <span class="server-ranking-player-name">Johnsample</span>
                  <span class="server-ranking-player-points">545488484
                    <i>points</i>
                  </span>
                </div>
            </li>
            <li>
              <span class="server-ranking-geral-posicao">6</span>
              <div class="server-ranking-player">
                <span class="server-ranking-player-name">Johnsample</span>
                <span class="server-ranking-player-points">545488484
                  <i>points</i>
                </span>
              </div>
            </li>
            <li>
              <span class="server-ranking-geral-posicao">7</span>
              <div class="server-ranking-player">
                <span class="server-ranking-player-name">Johnsample</span>
                <span class="server-ranking-player-points">545488484
                  <i>points</i>
                </span>
              </div>
            </li>
            <li>
              <span class="server-ranking-geral-posicao">8</span>
              <div class="server-ranking-player">
                <span class="server-ranking-player-name">Johnsample</span>
                <span class="server-ranking-player-points">545488484
                  <i>points</i>
                </span>
              </div>
            </li>
            <li>
              <span class="server-ranking-geral-posicao">9</span>
              <div class="server-ranking-player">
                <span class="server-ranking-player-name">Johnsample</span>
                <span class="server-ranking-player-points">545488484
                  <i>points</i>
                </span>
              </div>
            </li>
            <li>
              <span class="server-ranking-geral-posicao">10</span>
              <div class="server-ranking-player">
                <span class="server-ranking-player-name">Johnsample</span>
                <span class="server-ranking-player-points">545488484
                  <i>points</i>
                </span>
              </div>
            </li>-->
                        </ul>
                      </div>
                    </div>
                    <div class="server-ranking">
                      <h5 class="text-center">TOP ALLIANCES</h5>
                      <div class="server-ranking-top">

                        <li class="hidden {{numitemalliancernk}}" id="rnkTemplate">
                          <img src="Content/images/topcommanders-number{{numberalliancernk}}.png">
                          <div class="server-ranking-player">
                            <span class="server-ranking-player-name">{{allianceplayer}}</span>
                            <span class="server-ranking-player-server">{{alliancename}}</span>
                            <span class="server-ranking-player-points">{{alliancepoints}}
                              <i>points</i>
                            </span>
                          </div>
                        </li>

                        <ul id="allianceRanking">
                          <!-- RANKING SERVER SLIDER TOP 3 ALLIANCES ITENS -->

                          <!-- <li>
                 <img src="Content/images/topcommanders-number2.png">
                 <img class="server-ranking-player-avatar" src="Content/images/topalliances-avatar1.png">
                 <div class="server-ranking-player">
                   <span class="server-ranking-player-name">Johnsample</span>
                   <span class="server-ranking-player-server">AllianceName</span>
                   <span class="server-ranking-player-points">545488484
                     <i>points</i>
                   </span>
                 </div>
            </li>
            <li>
              <img src="Content/images/topcommanders-number3.png">
              <img class="server-ranking-player-avatar" src="Content/images/topalliances-avatar1.png">
              <div class="server-ranking-player">
                <span class="server-ranking-player-name">Johnsample</span>
                <span class="server-ranking-player-server">AllianceName</span>
                <span class="server-ranking-player-points">545488484
                  <i>points</i>
                </span>
              </div>
            </li>
            -->
                        </ul>
                      </div>
                      <div class="server-ranking-geral server-ranking-geral-servers ">
                        <li class="hidden" id="rnkTemplatemini">
                          <span class="server-ranking-geral-posicao">{{rankminipos}}</span>
                          <div class="server-ranking-player">
                            <span class="server-ranking-player-name">{{alliancenamernk}}</span>
                            <span class="server-ranking-player-points">{{alliancepointrnk}}
                              <i>points</i>
                            </span>
                          </div>
                        </li>
                        <ul class="" id="allianceRankingmini">
                          <!-- RANKING SERVER SLIDER GERAL ALLIANCES ITENS -->

                          <!--<li>
                <span class="server-ranking-geral-posicao">5</span>
                <img class="server-ranking-player-avatar" src="Content/images/topalliances-avatar2.png">
                <div class="server-ranking-player">
                  <span class="server-ranking-player-name">Johnsample</span>
                  <span class="server-ranking-player-points">545488484
                    <i>points</i>
                  </span>
                </div>
            </li>
            -->
                        </ul>
                      </div>
                    </div>
                  </div>

                </div>
                <!-- RANKING SERVER SLIDER ITEM -->
                <div class="servercontainer-content">
                  <div id="server-americo" class="servercontainer-content-item">
                  </div>

                </div>
                <!-- RANKING SERVER SLIDER ITEM -->
                <div class="servercontainer-content">
                  <div id="server-americo" class="servercontainer-content-item">
                  </div>

                </div>
                <!-- RANKING SERVER SLIDER ITEM -->
                <div class="servercontainer-content">
                  <div id="server-americo" class="servercontainer-content-item">
                  </div>

                </div>

              </div>
            </div>

          </div>
          <div class="col-xs-12">
            <div class="servercontainer">
              <!-- RANKING TITLE -->
              <div class="servercontainer-header">
                <h3>RIGHT NOW!</h2>
                  <h4>achievements & interactions
                </h3>
              </div>

              <div class="servercontainer-rightnow">

                <ul class="hidden" id="tplUpdates">
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-alquaim.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">{{playernameupdate}}</span>
                        <span class="servercontainer-rightnow-alliance">{{alliancenameupdate}}</span>
                        <span class="servercontainer-rightnow-points">{{pointsupdate}}
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      Got a new world checkpoint
                    </div>
                  </li>


                </ul>
                <ul id="listUpdates">

                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-horus.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">balyas</span>
                        <span class="servercontainer-rightnow-alliance">Most Points</span>
                        <span class="servercontainer-rightnow-points">40,745,603
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      POINTS LEADER
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-jarilo.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">Roninas</span>
                        <span class="servercontainer-rightnow-alliance">Most Points</span>
                        <span class="servercontainer-rightnow-points">44,427,683
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      POINTS LEADER
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-ares.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">Rexor</span>
                        <span class="servercontainer-rightnow-alliance">Most Points </span>
                        <span class="servercontainer-rightnow-points">63,351,390
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      POINTS LEADER
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-odin.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">Tony </span>
                        <span class="servercontainer-rightnow-alliance">Most Points</span>
                        <span class="servercontainer-rightnow-points">268,676,820
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      POINTS LEADER
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-horus.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">JusTDaNy</span>
                        <span class="servercontainer-rightnow-alliance">Most BattlePoints </span>
                        <span class="servercontainer-rightnow-points">21,316,267
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      BATTLE KING
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-jarilo.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">Predator</span>
                        <span class="servercontainer-rightnow-alliance">Most BattlePoints</span>
                        <span class="servercontainer-rightnow-points">24,066,573
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      BATTLE KING
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-ares.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">Rexor</span>
                        <span class="servercontainer-rightnow-alliance">Most BattlePoints</span>
                        <span class="servercontainer-rightnow-points">48,390,921
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      BATTLE KING
                    </div>
                  </li>
                  <li>
                    <div class="servercontainer-rightnow-item">
                      <img src="Content/images/icon-odin.svg">
                      <div class="servercontainer-rightnow-info">
                        <span class="servercontainer-rightnow-player">Tony </span>
                        <span class="servercontainer-rightnow-alliance">Most BattlePoints</span>
                        <span class="servercontainer-rightnow-points">39,615,932
                          <i>points</i>
                        </span>

                      </div>
                    </div>
                    <div class="servercontainer-rightnow-desc">
                      BATTLE KING
                    </div>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="hof">
      <div class="container">

      </div>


    </section>

    <div class="modal" tabindex="-1" role="dialog" id="registerModal">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Register Now</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body">
            <p style="display:none;" class="migration">Note: This is to register to the server, you must use your
              existing 2axion account:</p>
            <p style="display:none;" class="migration">Create your 2axion account at <a
                href="https://account.2axion.com/" target="_blank">https://account.2axion.com/</a></p>
            <form method="post" name="frmRegister" id="frmRegister">
              <div class="form-group">

                <label for="username">Username:</label>
                <input class="form-control" name="reg_user" id="reg_user" placeholder="Username">

              </div>
              <div class="form-group">

                <label for="password">Password:</label>
                <input class="form-control" name="reg_pass" id="reg_pass" placeholder="Password" type="password">

              </div>
              <div class="form-group">

                <label for="email">E-mail</label>
                <input class="form-control" name="reg_email" id="email" placeholder="E-mail">

              </div>
              <div class="form-group">

                <p class="text-info" for="bonuscode">If you have a bonus code, enter it <span class="text-warning"
                    id="isbonuscode">here.</span> </p>
                <div class="form-group hidden" id="bonuscode">
                  <label for="bonuscode">Bonus code (optional)</label>
                  <input class="form-control " name="reg_promo" placeholder="Bônus Code">
                </div>
              </div>


              <div class="input-group mb-3">
                <div class="checkbox_terms">
                  <label>I Agree: <input type="checkbox" name="reg_terms" id="reg_terms" checked="checked" value="1"
                      tabindex="40"><span></span></label>
                  <span class="pull-right">
                    <a class="pull-right" href="http://incuvationgames.com/general-terms" target="_blank">Terms and
                      Conditions</a> |
                    <a class="pull-right" href="https://forums.incuvationgames.com/viewtopic.php?f=26&amp;t=84#en"
                      target="_blank">Game rules</a>
                  </span>
                  <div class="status_box" original-title=""></div>
                </div>
              </div>

            </form>
          </div>
          <div class="modal-footer">
            <!--        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>-->
            <button type="button" id="register" class="btn btn-success btn-block">REGISTER</button>
          </div>
        </div>
      </div>
    </div>

    <div class="modal" tabindex="-1" role="dialog" id="supportModal">
      <div class="modal-dialog" role="document">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">Game Support</h5>
            <button type="button" class="close" data-dismiss="modal" aria-label="Close">
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
          <div class="modal-body" style="text-align: center;">
            Email <a href="mailto:nemexia@incuvationgames.com">nemexia@incuvationgames.com</a>
          </div>
        </div>
      </div>
    </div>


  </main>
  <footer style="text-align:center;color:#fff;margin-bottom:50px;padding-top:10px;">
    <a href="http://nemexia.nemexius.com/terms-and-conditions/" target="_blank">Terms and Conditions</a>
    | <a href="http://forums.incuvationgames.com/" target="_blank">Game Forum</a>
    | <a href="#" data-toggle="modal" data-target="#supportModal">Game Support</a>
    | <a href="http://help.nemexia.com/" target="_blank">Old Game Help</a>
    | <a href="http://nemexia.nemexius.com/" target="_blank">Game Info</a>
    | Copyright © 2021 2axion, LLC. All rights reserved.
  </footer>
  <script src="https://code.jquery.com/jquery-1.12.4.min.js"
    integrity="sha256-ZosEbRLbNQzLpnKIkEdrPv7lOy9C27hHQ+Xp8a4MxAQ=" crossorigin="anonymous"></script>
  <script src="https://unpkg.com/flickity@2/dist/flickity.pkgd.min.js"></script>
  <script src="Scripts/bootstrap.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-select/1.12.4/js/bootstrap-select.min.js"></script>
  <script src="Scripts/js.cookie.js"></script>
  <script src="Scripts/Global.js?10"></script>

  <script>
    $(function () {
      if (new Date() > new Date('2021-03-15'))
        $(".migration").show()

      // Randomize default server
      //const select  = document.getElementById('server')
      //const options = select.children
      //const random  = Math.floor(Math.random() * 3)
      //select.value = options[random].value
    })
  </script>

</body>

</html>