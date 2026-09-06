$(document).ready(function() {
    if(document.getElementById('hotLinksMenu') && document.getElementById('showHotLinks')) {
        var showHot = readCookie('hotLink');
        if( showHot == null) {
                createCookie('hotLink',1,30);
                showHot=1;
        }

        if(showHot == 1){
                document.getElementById('showHotLinks').style.display = 'none';
                document.getElementById('hotLinksMenu').style.display ='block';
        } else {
                document.getElementById('showHotLinks').style.display = 'block';
                document.getElementById('hotLinksMenu').style.display='none';
        }
    }

    //GlobalChatLoad ();
});

/**
function GlobalChatLoad () {
  $.post("ajax_global_chat.php", {
  }, function (response) {
    if (response.html)
     $("body").append (response.html);
  });
}
*/

$(document).on('headerHudToggleFinished', function() {
  headerAttentionSignsReposition();
});

$(window).resize(function () {
  headerAttentionSignsReposition();
});

$(document).click( function(e) {
    createCookie('actionid', Date.now());
    onDocClick(e);
});

function headerHudToggle() {
  $('#warningHeaderContainer').hide();
  $('#mainHeader').stop().hide('fade', 500, function() {
    $(this).toggleClass('minimized').show('fade', 250, function() {
      $('#warningHeaderContainer').show('fade', 250);
      $(document).trigger('headerHudToggleFinished');
    });
    createCookie('headerHudMinimized', $('#mainHeader').hasClass('minimized'), 365);
  });
}

function headerUpdateOzoneStatusWidget() {
  var widgetElem = $('#ozoneStatusWidget');
  var progress = Math.round(PLAYER['ozone'] / OZONE_MAXIMUM * 10) * 10;

  widgetElem.removeClass().addClass('fill' + progress);
}

function ozoneStatusWidgetGetTooltip() {
  var text = sprintf(HEADER_OZONESTATUSWIDGET_TOOLTIP_LEVEL_CURRENT, number_format(PLAYER['ozone']), number_format(OZONE_MAXIMUM));

  text += '<br /><br />' + sprintf(HEADER_OZONESTATUSWIDGET_TOOLTIP_GAIN, number_format(PLAYER['ozone_gain'] - PLAYER['ozone_loss']));

  if (PLAYER['ozone'] < 2000) {
    text += '<br /><br />' + html_entity_decode(PLANET_OZONE_WARNING_HIGH_TOOLTIP);
  } else if (PLAYER['ozone'] < 7000) {
    text += '<br /><br />' + html_entity_decode(PLANET_OZONE_WARNING_MEDIUM_TOOLTIP);
  } else if (PLAYER['ozone'] <= OZONE_MAXIMUM) {
    text += '<br /><br />' + html_entity_decode(PLANET_OZONE_WARNING_LOW_TOOLTIP);
  }

  return text;
}

function headerUpdateAdmiralLevelProgressWidget() {
  var widgetElem = $('#admiralLevelProgressWidget');
  var progress = 0;

  if (!PLAYER['admiral_is_max_level']) {
    progress = Math.round((100 - Math.ceil(((PLAYER['admiral_next_level_battle_points'] - PLAYER['battle_points']) / (PLAYER['admiral_next_level_battle_points'] - PLAYER['admiral_current_level_battle_points'])) * 100)) / 10) * 10;
  } else {
    progress = 100;
  }

  widgetElem.removeClass().addClass('fill' + progress);
}

function admiralLevelProgressWidgetGetTooltip() {
  var text = sprintf(HEADER_ADMIRALLEVELPROGRESSWIDGET_TOOLTIP_LEVEL_CURRENT, PLAYER['admiral_current_level']);

  if (PLAYER['admiral_is_max_level']) {
    text += '<br /><br />' + HEADER_ADMIRALLEVELPROGRESSWIDGET_TOOLTIP_MAX_LEVEL_REACHED;
  }

  if (!PLAYER['admiral_is_max_level'] && PLAYER['admiral_level_up_battle_points'] > 0) {
    text += '<br /><br />' + sprintf(HEADER_ADMIRALLEVELPROGRESSWIDGET_TOOLTIP_POINTS_TO_NEXT_LEVEL, number_format(PLAYER['admiral_level_up_battle_points']));
  }

  return text;
}

function toggleHotLinks() {
  if(document.getElementById('showHotLinks').style.display == 'none') {
    document.getElementById('showHotLinks').style.display='block';
    document.getElementById('hotLinksMenu').style.display='none';
    createCookie('hotLink',2,30);
  } else {
    document.getElementById('showHotLinks').style.display='none';
    document.getElementById('hotLinksMenu').style.display='block';
    createCookie('hotLink',1,30);
  }
}


function showTab(TabId, callback) {
    var bEmpty = true;
    $('#mainFrame > div').each(function(){
        if($(this).css('display') == 'block') {
            if(this.id == TabId) return false;
      $(this).slideUp('slow',function(){
        $('#' + TabId).slideDown('slow', callback);
        bEmpty = false;
      });
            return false;
        }
    });
}

function showPannel(mainContainer, pannel, callback, alwaysVisible) {
   $('#' + mainContainer +' > div').each(function(){
          if($(this).css('display') == 'block') {
            if (alwaysVisible) {
              if (alwaysVisible instanceof Array) {
                if (alwaVisible.indexOf(pannel) > -1) {
                  return true;
                }
              } else if (alwaysVisible == this.id) {
              return true;
            }
            }
              if(this.id == pannel) return false;
        $(this).slideUp('slow',function(){
          $('#' + pannel).slideDown('slow', callback);
          bEmpty = false;
        });
              return false;
          }
      });
}

function showDialogMessage(msg, callback) {
  if (callback !== undefined) {
    showDialogMessagePopup(msg, callback);
  } else {
    //AudioManager.play.newNotification();
    showDialogMessageNotification(msg);
  }

  return true;
}

function showDialogMessageNotification(msg) {
  $.pnotify.defaults.history = false;
  $.pnotify({
    text: msg,
    type: 'info',
    delay: 5000,
    addclass: pnotify_config_addclass,
    stack: pnotify_config_stack
  });
}

function showDialogMessagePopup(msg, callback) {
      //AudioManager.play.popupConfirm();
      $("#dialogBox").html('<p>' + msg + '</p><div class="dialogButtons"><input type="button" value="'+Ok+'" id="dlg_ok" /></div>');
      $("#dialogMessage").fadeIn('fast');
      $('#dlg_ok').click(function(){
          $("#dialogMessage").fadeOut('fast', callback);
      });
}

function showMessage(msg,type,container){
    var hdr = Success, cls = 'information';
    switch(parseInt(type)){
        case 4:hdr = Attention;cls = 'information';
          break;
        case 3:hdr = Info;cls = 'information';
          break;
        case 2:hdr = StringError;cls = 'error';//AudioManager.play.popupDeny();
          break;
        case 1:hdr = Success;cls = 'success';
          break;
        default:
            hdr = Attention;
            cls = 'information';
    }
    if(!isset(container)) container = 'mainFrame';
    $("#"+container).prepend("<div id=\"resultMessage\" class=\"message "+cls+"\" style=\"display:none;\"><div class=\"sub\"> \
    <h2>"+hdr+"</h2> "+msg+"</div> </div>");
    $("#resultMessage").slideDown("slow");
      return true;
}

function hideMessages(speed){
    $('.message').each(function(){
        if(speed !== undefined) {
            $(this).slideUp(speed).empty();
        } else {
            $(this).hide().empty();
        }
    });
}

function hideDialog(speed, callback){
    $("#dialogMessage").fadeOut(speed, callback);
}

function paymentsOpen() {
  if (typeof (paymentsDisplayFunction) === "function") {
    paymentsDisplayFunction();
  } else {
    paymentsCommonOpen();
  }
}

function paymentsCommonOpen() {
  floatingEnable = 0;
  $("#dialogBox").html('<a href="javascript:void(0);" onclick="paymentsCommonClose();" class="closeDialog"></a><iframe name="paymentsIframe" src="' + paymentsUrl + '" style="width: 890px;height: 700px" frameborder="0" />');
  $("#dialogMessage").addClass('PaymentsDefaultPopup').fadeIn("slow");
  $('.black_overlay').bind('click', function(){paymentsCommonClose()}).show();
  return;
}

function paymentsCommonClose() {
  $('.black_overlay').unbind('click').hide();
  $("#dialogMessage").fadeOut('fast').removeClass('PaymentsDefaultPopup');
  floatingEnable = 1;
  return;
}

function surveyOpen(url) {
  floatingEnable = 0;
  $("#dialogBox").html('<a href="javascript:void(0);" onclick="surveyClose();" class="closeDialog"></a><iframe name="surveyIframe" src="' + url + '" style="width: 800px;height: 700px" frameborder="0" />');
  $("#dialogMessage").addClass('SurveyDefaultPopup').fadeIn("slow");
  $('.black_overlay').bind('click', function(){surveyClose();}).show();
  return;
}

function surveyClose() {
  $('.black_overlay').unbind('click').hide();
  $("#dialogMessage").fadeOut('fast').removeClass('SurveyDefaultPopup');
  floatingEnable = 1;
  if(typeof LoginPopupsQueue == 'object') {
    LoginPopupsQueue.exec();
  }
  return;
}

function supportOpen() {
  if (gameSupportUrl.length <= 1) {
    return;
  }
  floatingEnable = 0;
  $("#dialogBox").html('<a href="javascript:void(0);" onclick="supportClose();" class="closeDialog"></a><iframe width="100%" height="700" frameborder="0" scrolling="auto" src="' + gameSupportUrl + '" allowtransparency="true"></iframe>');
  $("#dialogMessage").addClass('SupportDefaultPopup').fadeIn("slow");
  $('.black_overlay').bind('click', function(){supportClose()}).show();
  return;
}

function supportClose() {
  $('.black_overlay').unbind('click').hide();
  $("#dialogMessage").fadeOut('fast').removeClass('SupportDefaultPopup');
  floatingEnable = 1;
  return;
}

function paymentsFBPOpen() {
  floatingEnable = 0;
  $("#dialogBox").html('<a href="javascript:void(0);" onclick="paymentsFBPClose();" class="closeDialog"></a><iframe name="paymentsFBPIframe" src="' + paymentsFBPUrl + '" style="width: 800px;height: 700px" frameborder="0" />');
  $("#dialogMessage").addClass('PaymentsFBPPopup').fadeIn("slow");
  $('.black_overlay').bind('click', function(){paymentsFBPClose()}).show();
  return;
}

function paymentsFBPClose() {
  $('.black_overlay').unbind('click').hide();
  $("#dialogMessage").fadeOut('fast').removeClass('PaymentsFBPPopup');
  floatingEnable = 1;
  return;
}

function showConfirm(msg, confirmFunc, rejectFunc, confirmLabel, rejectLabel) {
    var uid = (new Date()).valueOf();

  //AudioManager.play.popupConfirm();

  if (confirmLabel == undefined || confirmLabel == '') {
    confirmLabel = Yes;
  }

  if (rejectLabel == undefined || rejectLabel == '') {
    rejectLabel = No;
  }

    $("#dialogBox").empty().html('<p>' + msg + '</p><div class="dialogButtons"><input type="button" value="'+confirmLabel+'" id="'+uid+'" />&nbsp;<input type="button" value="'+rejectLabel+'" id="'+uid+'_NO" /></div>');
    $('#'+uid).bind('click', function(){
    $('#'+uid).unbind('click');
        $("#dialogMessage").fadeOut("slow", confirmFunc);
    });

    if (jQuery.isFunction(rejectFunc)) {
      $('#'+uid + '_NO').click(function(){
        $("#dialogMessage").fadeOut("slow", rejectFunc);
        });
    } else {
      $('#'+uid + '_NO').click(function(){
        $("#dialogMessage").fadeOut("slow");
        });
    }

    $("#dialogMessage").fadeIn('fast');
    return false;
}

function ChooseRace(raceId) {
  floatingEnable = 1;

  window.location.href='choose_race.php?race=' + raceId;
}

function autoSessionRefresh() {
  window.setTimeout("refreshSession('autosession',function() { autoSessionRefresh() });",AUTOREFRESH_TIME * 1000); //1 minute
}


function refreshSession(type,callback) {
    $.post("ajax_main.php",{
            type: type
    }, function(xml) {
    try {
      var info = eval('(' + xml + ')');
    } catch (err) {
      eval(xml);
    }

        PLAYER['metal'] = info.metal;
        PLAYER['max_metal'] = info.max_metal;
        PLAYER['crystal'] = info.crystal;
        PLAYER['max_crystal'] = info.max_crystal;
        PLAYER['gas'] = info.gas;
        PLAYER['max_gas'] = info.max_gas;
        PLAYER['recycle'] = info.recycle;
        PLAYER['energy'] = info.free_energy;
        PLAYER['pop_used'] = info.pop_used;
    PLAYER['pop_station'] = info.pop_station;
    PLAYER['defence_pop_used'] = info.defence_pop_used;
        PLAYER['pop'] = info.pop;
        PLAYER['credits'] = info.credits;
        PLAYER['stars'] = info.stars;
        PLAYER['phase'] = info.phase;

        //Set Resource Tip Values
        PLAYER['metalFormat'] = number_format(info.metal) + '';
        PLAYER['maxMetalFormat'] = number_format(info.max_metal) + '';
        PLAYER['crystalFormat'] = number_format(info.crystal) + '';
        PLAYER['maxCrystalFormat'] = number_format(info.max_crystal) + '';
        PLAYER['gasFormat'] = number_format(info.gas) + '';
        PLAYER['maxGasFormat'] = number_format(info.max_gas) + '';
        PLAYER['popFormat'] = number_format(info.pop);

    PLAYER['ozone'] = info.ozone;

    PLAYER['battle_points'] = info.battle_points;
    PLAYER['admiral_current_level'] = info.admiral_current_level;
    PLAYER['admiral_is_max_level'] = info.admiral_is_max_level;
    PLAYER['admiral_current_level_battle_points'] = info.admiral_current_level_battle_points;
    PLAYER['admiral_next_level_battle_points'] = info.admiral_next_level_battle_points;
    PLAYER['admiral_level_up_battle_points'] = info.admiral_level_up_battle_points;

        $('#boxResMetal').html(number_format(info.metal) + '');
        $('#boxResCrystal').html(number_format(info.crystal) + '');
        $('#boxResGas').html(number_format(info.gas) + '');
        $('#boxResEnergy').html(number_format(info.free_energy) + '');
    $('#boxResRecycle').html(number_format(info.recycle) + '');
        $('#resourceBoxHangarShips').html(number_format(info.pop_used));
    if (info.pop_station > 0) {
       $('#resourceBoxHangarShips').append(' <span style="color: #00ff00;"> + ' + number_format(info.pop_station) + '</span>');
    }
    $('#resourceBoxHangarDefence').html(number_format(info.defence_pop_used));
        $('#creditsHolder').html(number_format(info.credits) + '');
        $('#starsHolder').html(number_format(info.stars) + '');

        if(isset(info.online) && isset(info.active)) {
          $('.activePlayers').html(info.active);
          $('.onlinePlayers').html(info.online);
        }

    headerUpdateOzoneStatusWidget();
    headerUpdateAdmiralLevelProgressWidget();
    headerAttentionSignsUpdate();
    headerAuctionTooltipUpdate(info.auctionUnusedPackagesCount);

        if(typeof(callback) != 'undefined' ){
            if( typeof(callback) == 'string' ) {
                eval(callback);
            } else if( typeof(callback) == 'function') {
                callback.call();
            }
        }

    $(document).trigger('refreshSessionComplete');
    });
    return;
}

function headerAttentionSignsReposition() {
  $('#warningHeaderContainer a').each(function(key, element){
    var targetElement = $('#' + $(element).attr('data-target'));
    if (targetElement.length == 0) {
      return;
    }

    var newTop = targetElement.offset().top;
    var newLeft = targetElement.offset().left;

    if (targetElement.parent().parent().hasClass('minimized')) {
      newTop += -3;
      if ($('html').attr('dir') === 'rtl') {
        newLeft += targetElement.width() + 22;
      } else {
        newLeft += -3;
      }
    } else {
      newTop += 4;
      if ($('html').attr('dir') === 'rtl') {
        if (targetElement.parent().hasClass('right')) {
          newLeft += targetElement.width() + 10;
        } else {
          newLeft += 42;
        }
      } else {
        if (targetElement.parent().hasClass('left')) {
          newLeft += targetElement.width() - 10;
        } else {
          newLeft += 32;
        }
      }
    }

    $(element).css('top', newTop).css('left', newLeft);
  });
}
function headerAttentionSignsUpdate() {
  var elementAttentionSign = false;
  var targetElement = false;
  var multiplier = 1;
  var currentValue = 1;
  var maxValue = 1;
  for (i in headerAttentionSignsMap) {
    elementAttentionSign = $('#warningHeaderContainer a[data-type="' + i + '"]');
    elementAttentionSign.hide();

    targetElement = $('#' + elementAttentionSign.attr('data-target'));
    if (i == 'hangarShips') {
      targetElement = $('#resourceBoxHangarShips');
    } else if (i == 'hangarDefence') {
      targetElement = $('#resourceBoxHangarDefence');
    }
    if (!targetElement.is(':visible')) {
      continue;
    }

    multiplier = 1;
    if (headerAttentionSignsMap[i].check == '<') {
      multiplier = -1;
    }

    maxValue = parseInt(PLAYER[headerAttentionSignsMap[i].sourceMax]);
    if (i == 'energy') {
      maxValue = headerAttentionSignsMap[i].sourceMax;
    }


    if (i == 'hangarShips') {
      currentValue = (parseInt(PLAYER[headerAttentionSignsMap[i].sourceField]) + parseInt(PLAYER['pop_station'])) / maxValue;
    } else {
      currentValue = parseInt(PLAYER[headerAttentionSignsMap[i].sourceField]) / maxValue;
    }

    if (currentValue * multiplier > headerAttentionSignsMap[i].high * multiplier) {
      elementAttentionSign.attr('data-tooltip', eval('HEADER_' + headerAttentionSignsMap[i].stringKey + '_WARNING_HIGH_TOOLTIP'));
      elementAttentionSign.removeClass().addClass('warning').addClass('high').show();

    } else if (currentValue * multiplier > headerAttentionSignsMap[i].medium * multiplier) {
      elementAttentionSign.attr('data-tooltip', eval('HEADER_' + headerAttentionSignsMap[i].stringKey + '_WARNING_MEDIUM_TOOLTIP'));
      elementAttentionSign.removeClass().addClass('warning').addClass('medium').show();

    } else if (currentValue * multiplier > headerAttentionSignsMap[i].low * multiplier) {
      elementAttentionSign.attr('data-tooltip', eval('HEADER_' + headerAttentionSignsMap[i].stringKey + '_WARNING_LOW_TOOLTIP'));
      elementAttentionSign.removeClass().addClass('warning').addClass('low').show();

    }
  }
}

function headerAuctionTooltipUpdate(unusedPackagesCount) {
  $('#AuctionAdmiralButton').attr('data-unused-packages', unusedPackagesCount);
  if (unusedPackagesCount > 0) {
    $('#AuctionAdmiralButton').addClass('active');
  } else {
    $('#AuctionAdmiralButton').removeClass('active');
  }
}

function headerArenaTooltipUpdate(hasReturningUnits) {
  $('#ArenaButton').attr('data-has-returning-units', hasReturningUnits);
  if (hasReturningUnits > 0) {
    $('#ArenaButton').addClass('active');
  } else {
    $('#ArenaButton').removeClass('active');
  }
}

function SecToTime(s) {
  if(typeof(s) == 'undefined') return 0;
  s=Math.round(s);
  var m=0;
  var h=0;
  if(s>59) {
    m=Math.floor(s/60);
    s-=m*60;
  }
  if(m>59) {
    h=Math.floor(m/60);
    m=m-h*60;
  }
  if(s<10) s="0"+s;
  if(m<10) m="0"+m;
  if(h<10) h="0"+h;

  return h+":"+m+":"+s;
}

var Timers = new Array();
var CountTimers = 0;
function CountDown() {
    window.setTimeout("CountDown()", 999);

    if (typeof(Timers[0]) == "undefined") {
    return;
  }

    for (i = 0; i < Timers.length; i++) {
        var s = Math.round(Timers[i][1]);
        if(s < 0) {
            if(Timers[i][2] != 'STOP') {
                eval(Timers[i][2]);
                Timers[i][2] = 'STOP';
            }
        } else {
      if ($('#' + Timers[i][0]).length > 0) {
        $('#' + Timers[i][0]).html(SecToTime(s));
      }

            Timers[i][1]--;
        }
    }
}


function TeamRefresher(type) {
  $.post("ajax_team_refresher.php",{
    type:type
  }, function(response){
    if(response == '1') {
      window.location.reload();
      return;
    } else {
      window.setTimeout("TeamRefresher('" + type + "')",2000);
    }
  });
}

function initializeSlider(elementHandler,startValue){
  var min = $('#'+elementHandler + '-min').attr('title') * 1;
  var max = $('#'+elementHandler + '-max').attr('title') * 1;
  $('#'+elementHandler + '-value').html(startValue);
  $('#'+elementHandler).slider({
    handle: '#'+elementHandler+'-Handel',
    range: "min",
    min: min,
    max: max,
    value: startValue,
    animate: true,
    slide: function(event, ui) {
      var Handelid = ui.handle.id;
      var id = Handelid.replace('Handel', "value");
      document.getElementById(id).innerHTML = ui.value;
    }
  });
}

function sliderMoveTo(elementHandler,move) {
  var min = $('#'+elementHandler + '-min').attr('title') * 1;
  var max = $('#'+elementHandler + '-max').attr('title') * 1;
  var val = $('#'+elementHandler).slider('option', 'value') * 1;
  val+=move;
  if(val<min) val = min;
  if(val>max) val = max;

  $('#'+elementHandler).slider('option', 'value', val);
  $('#'+elementHandler+'-value').html(val);
}

function sliderMoveOn(elementHandler, val) {
  var min = $('#' + elementHandler + '-min').attr('title') * 1;
  var max = $('#' + elementHandler + '-max').attr('title') * 1;

  val = parseInt(val);
  if (isNaN(val)) {
    val = min;
  }

  if(val<min) val = min;
  if(val>max) val = max;

  $('#' + elementHandler).slider('option', 'value', val);
  $('#' + elementHandler + '-value').html(val);

  return val;
}

function sliderSetMax(elementHandler, val) {
  $('#' + elementHandler + '-max').attr('title', val);
  $('#' + elementHandler).slider('option', 'max', val);
}

function sliderUpdateInput(elementHandler) {
  $('#' + elementHandler + '-value-input').val($('#' + elementHandler + '-value').html());
}

function reloadImage(imgSender,url) {
  var preLoadedImage=new Image();

  preLoadedImage.src=url + '#rand='+(new Date()).getTime();
  preLoadedImage.onload=function(){
    imgSender.src=preLoadedImage.src;
  };
}

function isset(value) {
    if (typeof(value)=='undefined' || value===null) return false;
    return true;
}

function clearForm(form, zeros) {
    if( zeros === undefined ) zeros = false;

    if(form instanceof String || new String(typeof(form)).toLowerCase() == 'string')
        if( form.substr(0,1) != '#' ) form = '#'.form;
        form = $(form);

    $(':input', form).each(function() {
  var type = this.type;
  var tag = this.tagName.toLowerCase(); // normalize case

  if (type == 'text' || type == 'password' || type == 'hidden' || tag == 'textarea') {
            if( zeros && type == 'text' )
                this.value = '0';
            else
                this.value = '';
        } else if (type == 'checkbox' || type == 'radio'){
            this.checked = false;
        } else if (tag == 'select') {
            this.selectedIndex = -1;
        }
    });
    return false;
};

function filterIntDigits(_this){
    if(! _this ) _this = this;
    _this.value = _this.value.replace(/[^\d]/gi,'');
}

function serverTime(renderTimeCorrection) {
  if (renderTimeCorrection == undefined) {
    renderTimeCorrection = 0;
  }
  currentTime.setSeconds(currentTime.getSeconds() + 1 + renderTimeCorrection);

  var h = currentTime.getHours();
  var m = currentTime.getMinutes();
  var s = currentTime.getSeconds();

  if(h < 10) h = 0 + "" + h;
  if(m < 10) m = 0 + "" + m;
  if(s < 10) s = 0 + "" + s;

  $('#serverTimeDisplay').html(h + ":" + m + ":" + s);

  if (BOTCHECK_ACTIVE == true && BOT_CHECK > 0) {
    BOT_CHECK--;
    if(BOT_CHECK < 1) {
      window.location.href=URL_REDIRECT;
    }

    if (BOT_CHECK <= 300) {
      $('#serverTimeDisplay').addClass('expireWarning');
    }
  }

  window.setTimeout("serverTime()",1000);
}

function paymentsFBPTimerTick() {
  var timerElement = $('#paymentsFBPTimeDisplay');
  var timeLeft = parseInt(timerElement.attr('data-time-left'));

  --timeLeft;

  timerElement.html(SecToTime(timeLeft, true));
  timerElement.attr('data-time-left', timeLeft);

  if (timeLeft < 1) {
    timerElement.fadeOut();
    paymentsFBPTick = window.clearInterval(paymentsFBPTick);
  }
}

function getServerTimeTooltip() {
  var tooltipText = StringServerTime;

  if (BOTCHECK_ACTIVE == true && BOT_CHECK > 0) {
    tooltipText += '<br /><br />';
    tooltipText += sprintf(StringBotcheckTime, Math.ceil(BOT_CHECK / 60));
  }

  return tooltipText;
}

function number_format(number, decimals, dec_point, thousands_sep) {
    // Formats a number with grouped thousands
    // version: 906.1806
    var n = number, prec = decimals;

    var toFixedFix = function (n,prec) {
        var k = Math.pow(10,prec);
        return (Math.round(n*k)/k).toString();
    };

    n = !isFinite(+n) ? 0 : +n;
    prec = !isFinite(+prec) ? 0 : Math.abs(prec);
    var sep = (typeof thousands_sep === 'undefined') ? THO_SEPARATOR : thousands_sep;
    var dec = (typeof dec_point === 'undefined') ? DEC_SEPARATOR : dec_point;

    var s = (prec > 0) ? toFixedFix(n, prec) : toFixedFix(Math.round(n), prec); //fix for IE parseFloat(0.55).toFixed(0) = 0;

    var abs = toFixedFix(Math.abs(n), prec);
    var _, i;

    if (abs >= 1000) {
        _ = abs.split(/\D/);
        i = _[0].length % 3 || 3;

        _[0] = s.slice(0,i + (n < 0)) +
              _[0].slice(i).replace(/(\d{3})/g, sep+'$1');
        s = _.join(dec);
    } else {
        s = s.replace('.', dec);
    }

    var decPos = s.indexOf(dec);
    if (prec >= 1 && decPos !== -1 && (s.length-decPos-1) < prec) {
        s += new Array(prec-(s.length-decPos-1)).join(0)+'0';
    }
    else if (prec >= 1 && decPos === -1) {
        s += dec+new Array(prec).join(0)+'0';
    }
    return s;
}

function createCookie(name,value,days) {
  if (days) {
    var date = new Date();
    date.setTime(date.getTime()+(days*24*60*60*1000));
    var expires = "; expires="+date.toGMTString();
  }
  else var expires = "";
  document.cookie = name+"="+value+expires+"; path=/";
}

function readCookie(name) {
  var nameEQ = name + "=";
  var ca = document.cookie.split(';');
  for(var i=0;i < ca.length;i++) {
    var c = ca[i];
    while (c.charAt(0)==' ') c = c.substring(1,c.length);
    if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
  }
  return null;
}

function eraseCookie(name) {
  createCookie(name,"",-1);
}

function changeLanguage(langCode) {
  $.post('ajax_misc.php', {
    type: 'changeLanguage',
    lang: langCode
  }, function(response){
    var info = eval('(' + response + ')');
    if(info.status == 1) {
      document.location.reload(true);
      return true;
    }
  });
}

function stopPropagationCompat(e) {
  if (!e) var e = window.event;
  e.cancelBubble = true;
  if (e.stopPropagation) e.stopPropagation();
}


// Quester functions

function QuesterBlink() {
  $('#adviserLink a.active').fadeOut('slow',
    function() {
      $('#adviserLink a.active').fadeIn('slow');
    });
  window.setTimeout("QuesterBlink()",3000);
}

function QuesterLoad() {
  if (RACE_ID == 0) {
    return false;
  }

  // Close currently open dialogs if any
  hideDialog('fast');

  $.post("ajax_quester.php",{
    type: 'loadDetails'
  }, function(response) {
    if (response == '') {
      return false;
    }

    // Activate the quester image
    $('#adviserLink').removeClass('inactive');

    // Remove the Adviser message
    $('#adviserLink a').removeClass('active');
    $('#adviserMessage').hide();

    $('#adviserWrapper').html(response);
    $('#QuesterMissionDetails').show();

    // Show the quester window
    $('#adviserOverlay, #adviserWrapper').show('fast');
  });
}

function QuesterStart() {
  $.post("ajax_quester.php",{
    type: 'missionComplete'
  }, function(response) {
    info = eval('(' + response + ')');
    if (info.status == false) {
      return false;
    }
    QuesterLoad();
  });
}

function QuesterGetReward() {
  $.post("ajax_quester.php",{
    type: 'missionComplete'
  }, function(response) {
    info = eval('(' + response + ')');
    if (info.status == false) {
      return false;
    }

    refreshSession('session');

    // Hide/Show details
    $('#QuesterMissionDetails').hide();
    $('#QuesterSuccessDetails').show();

    // Hide/show buttons
    $('#QuesterTakeBtn').hide();
    $('#QuesterNextBtn').show();
  });
}

function QuesterHide() {
  $('#adviserOverlay, #adviserWrapper').hide('fast');
}

function QuesterDisable() {
  $.post("ajax_quester.php",{
    type: 'disable'
  }, function(response) {
    info = eval('(' + response + ')');
    showDialogMessage(info.message);

    QuesterHide();

    $('#adviserLink').addClass('inactive');
  });
}

// Global queue functions

function globalQueueLoad() {
  var showGlobalQueueStatus = readCookie('GlobalQueueBar');
  if(showGlobalQueueStatus != 1) {
    return;
  }

  $.post("ajax_global_queue.php?uid="+(new Date()).valueOf(),{
    type: 'loadList'
  }, function(response) {
    TimersGlobalQueue = new Array();
    GlobalQueueCountTimers = 0;
    $('.queItemHolder').html(response);
  });
}

function globalQueueShow() {
  createCookie('GlobalQueueBar', 1, 30);
  globalQueueLoad();

  $('#queueBarOpen').show();
  $('#queueBarClose').hide();
}

function globalQueueHide() {
  createCookie('GlobalQueueBar', 2, 30);
  $('#queueBarOpen').hide();
  $('#queueBarClose').show();
}

function globalQueueTimers() {
  window.setTimeout("globalQueueTimers()",999);

  if(typeof(TimersGlobalQueue[0])=="undefined") return;

  var v=new Date();
  var n=new Date();

  for (i=0; i < TimersGlobalQueue.length; i++) {
    var CounterBox = document.getElementById(TimersGlobalQueue[i][0]);
    var s=TimersGlobalQueue[i][1]-Math.round((n.getTime()-v.getTime())/1000.);
    if(s < 0) {
      if(TimersGlobalQueue[i][2] != 'STOP') {
        eval(TimersGlobalQueue[i][2]);
        TimersGlobalQueue[i][2] = 'STOP';
      }
    } else {
      if (document.getElementById(TimersGlobalQueue[i][0])) {
        CounterBox.innerHTML=SecToTime(s);
      }
      TimersGlobalQueue[i][1]--;
    }
  }
}

function sittersLoginAsSelf() {
  $.post('ajax_sitters.php', {
    type: 'loginAsSelf'
  }, function(response){
    try {
      eval('('+ response + ')');
    } catch (e) {
      eval(response);
    }
  });
}

function sittersLoginAsSitter(contractId) {
  $.post('ajax_sitters.php', {
    type: 'loginAsSitter',
    contract_id: contractId
  }, function(response){
    try {
      var info = eval('('+ response + ')');
      showDialogMessage(info.message);

      // Reload the login menu
      sittersLoadSignedBabies(true);
    } catch (e) {
      eval(response);
    }
  });
}

function sittersLoadSignedBabies(forceReload) {
  if ((forceReload == undefined || forceReload == false) && $('#sittersLoginList').html() !== '') {
    return true;
  }

  $('#sittersLoginList').html('<li style="text-align: center;"><img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/loading_building.gif" border="0" /></li>');

  $.post('ajax_sitters.php', {
    type: 'loadLoginList'
  }, function(response){
    $('#sittersLoginList').html(response);
  });

  return true;
}

function sendSpyToPlanet(pc1, pc2, pc3) {
  var requestData = {
    type: 'SendFleet',
    mission: 2,
    speed: 10,
    metal: 0,
    crystal: 0,
    gas: 0,
    scrap: 0,
    c1: pc1,
    c2: pc2,
    c3: pc3,
    battle_rounds: 12,
    speed_motivation: 0,
    scrap_motivation: 0,
    flight_hours: 0,
    flight_minutes: 0
  };
  requestData['ship[' + RACE_ID  + '][12]'] = 1;

  $.post("ajax_fleets.php", requestData, function(response){
    var info = eval('(' + response + ')');

    if(info.pass == '0') {
      showDialogMessagePopup(info.info);
      return false;
    } else {
      showDialogMessage(Success);
      return true;
    }
  });
}

function CallQueue(maxItemsCount) {
  this.current = 0;
  this.queue = new Array();
  this.maxItemsCount = maxItemsCount;

  this.add = function(callback) {
    if (this.queue.length >= this.maxItemsCount) {
      return false;
    }

    this.queue.push(callback);

    return true;
  }

  this.exec = function() {
    callback = this.queue[this.current];

    if (typeof(callback) == 'string') {
      eval(callback);
    } else if (typeof(callback) == 'function') {
      callback.call();
    } else {
      return;
    }

    this.current++;
  }

  this.reset = function() {
    this.current = 0;
  }
}

function firePremiumPopupEvent(event) {
  if (window.premiumPopup != undefined) {
    window.premiumPopup.fireEvent(event);
  }
}

function addPremiumPopupEventListener(event, callback) {
  if (typeof callback != 'function') {
    throw 'Callback must be a function';
  }
  if (window.premiumPopup != undefined) {
    premiumPopup.addListener(event, callback);
    return;
  }
  if (window._premiumPopupListeners == undefined) {
    window._premiumPopupListeners = {};
  }
  if (window._premiumPopupListeners[event] == undefined) {
    window._premiumPopupListeners[event] = [];
  }
  window._premiumPopupListeners[event].push(callback);
}

function openPremiumPopup(tabId) {
  $("#dialogMessage").hide();
  if (window.premiumPopup != undefined) {
    if (tabId != undefined) {
      window.premiumPopup.showTab(tabId);
    }
    window.premiumPopup.show();
    return;
  }
  var url = "ajax_premium.php?method=showPremiumPopup";
  if (tabId) {
    url += "&tabId=" + tabId;
  }
  $('#premiumPopupContainer').load(url);
}

function openPlatinumPopup(tabId) {
  $("#dialogMessage").hide();
  if (window.platinumPopup != undefined) {
    if (tabId != undefined) {
      window.platinumPopup.showTab(tabId);
    }
    window.platinumPopup.show();
    return;
  }
  var url = "ajax_platinum.php?method=showPlatinumPopup";
  if (tabId) {
    url += "&tabId=" + tabId;
  }
  $('#platinumPopupContainer').load(url);
}

function DependencyResolver() {

  var _loaded = [];
  var _postponded = [];

  function _checkDependencies(dependencies) {
    // Check if all dependencies are met
    for (var i = 0; i < dependencies.length; i++) {
      for (var j = 0; j < _loaded.length; j++) {
        if (dependencies[i] == _loaded[j]) {
          // The dependency is met
          break;
        }
      }
      if (j == _loaded.length) {
        // The dependency is not met
        return false;
      }
    }
    // All dependecies have been met
    return true;
  }

  this.execute = function(dependencies, func) {
    if (typeof dependencies == 'string') {
      dependencies = [dependencies];
    } else if (!(dependencies instanceof Array)) {
      throw 'Dependencies must be either array or string';
    }
    if (typeof func != 'function') {
      throw 'Bad function';
    }
    if (_checkDependencies(dependencies)) {
      func();
      return true;
    }
    _postponded.push({dependencies: dependencies, func: func});
    return false;
  };

  this.markAsLoaded = function(dependency) {
    if (typeof dependency != 'string') {
      throw 'Dependency must be a string';
    }
    _loaded.push(dependency);
    for (var i = 0; i < _postponded.length; i++) {
      if (_checkDependencies(_postponded[i].dependencies)) {
        _postponded[i].func();
        _postponded.splice(i, 1);
        i--;
      }
    }
  };
}
window.dependencyResolver = new DependencyResolver();


function onFBEventSubscribe(response) {
  $.post('ajax_misc.php', {
    type: 'facebookSubscribeReward'
  }, function(response){
    if (response.status != true) {
      return;
    }

    showDialogMessage(response.message);
  }, 'json');
}

function updateValueAnimated(element, value) {
  if (element.html().trim() == value.toString().trim()) {
    return;
  }

  $(element).effect("puff", {
    percent: 110
  }, 200, function(){
    $(this).html(value).effect("fade");
  });
}

function animateSideMenuOnPageScroll(floatedElementSelector, offsetThreshold) {
  var newTop = 0;
  if (window.pageYOffset > offsetThreshold) {
    newTop = window.pageYOffset - offsetThreshold + 10;
  }

  $(floatedElementSelector).delay(150).stop(true, true).animate({
    top: newTop
  }, 600, 'easeInQuad');
}

function html_entity_decode(string) {
  return $('<div/>').html(string).text();
}

function executeCallback(callback) {
  if (typeof (callback) === 'string') {
    eval(callback);
  } else if (typeof (callback) === 'function') {
    callback.call();
  }
}

function onDocClick(e)
{
    //if(GID==105) alert('click!');
    var posx = 0;
    var posy = 0;
    if (!e) var e = window.event;
    if (e.pageX || e.pageY) {
            posx = e.pageX;
            posy = e.pageY;
    }
    else if (e.clientX || e.clientY) {
            posx = e.clientX + CACHED_WINDOW.x;
            posy = e.clientY + CACHED_WINDOW.y;
    }
    var cc = Math.floor(posy*10000 + posx*1.0);
    createCookie('clickcoords',posy*10000 + posx);
}

/**
 * thenBy.js micro library
 * https://github.com/Teun/thenBy.js
 */
firstBy=(function(){function e(f){f.thenBy=t;return f}function t(y,x){x=this;return e(function(a,b){return x(a,b)||y(a,b)})}return e})();
