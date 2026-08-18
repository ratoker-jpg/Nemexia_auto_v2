var squaresInfo = {};
var galaxyMove = false;
var page = 0;

// Define required variables for slider... arrow text and etc.
var slidesArrowText, minLeft, maxLeft = 0, step = 9 * 108;
if (maxCoords.c2 == 40) {
	minLeft = -3888;
	slidesArrowText = [
		{left: '37 - 40', right: '10 - 18'},
		{left: '1 - 9', right: '19 - 27'},
		{left: '10 - 18', right: '28 - 36'},
		{left: '19 - 27', right: '37 - 40'},
		{left: '28 - 36', right: '1 - 9'}
	];
} else {
	minLeft = -7776;
	slidesArrowText = [
		{left: '37 - 40', right: '10 - 18'},
		{left: '1 - 9', right: '19 - 27'},
		{left: '10 - 18', right: '28 - 36'},
		{left: '19 - 27', right: '37 - 45'},
		{left: '28 - 36', right: '46 - 54'},
		{left: '37 - 45', right: '55 - 63'},
		{left: '46 - 54', right: '64 - 72'},
		{left: '55 - 63', right: '73 - 81'},
		{left: '64 - 72', right: '1- 9'},
		{left: '73 - 81', right: '10 - 18'}
	];
}

jQuery(document).ready(function(){
	refreshGalaxy();
});

MouseOverFix=0;
function refreshGalaxy() {
    var galaxy = $('#c1').val();
    var solar = $('#c2').val();
    var planets = 0;

    UnTip();

    if(galaxy > maxCoords.c1) {
    	galaxy = maxCoords.c1;
    	$('#c1').val(maxCoords.c1);
    }
    if(solar > maxCoords.c2) {
    	solar = maxCoords.c2;
    	$('#c2').val(maxCoords.c2);
    }

    $('#galaxyHolder').fadeOut('slow',function(){
	    $('#galaxyLoading').show();
	    UnTip();
	    $.post("ajax_galaxy.php",{ galaxy: galaxy, solar: solar, planets: planets,page: page }, function(response){
	    	UnTip();
	    	var info = eval('(' + response + ')');

		    if( info.redirect == 1 )
			    document.location = 'playerInfo.php?player_id=' + info.response;
		    else
			    $('#galaxyHolder').html(info.response);
			    $('#galaxyHolder').fadeIn('normal', function(){
					$('#galaxyLoading').hide();
				});
	    });
    });

    if(galaxy == 0) {
    	$('#breadCrumb-c1').hide();
    } else {
    	$('#breadCrumb-c1').html(LangString.Galaxy + ' ' + galaxy);
    	$('#breadCrumb-c1').show();
    }

    if(solar == 0) {
    	$('#breadCrumb-c2').hide();
    } else {
    	$('#breadCrumb-c2').html(LangString.SolarSytem + ' ' + solar);
    	$('#breadCrumb-c2').show();
    }

}

function galaxyScrollLeft() {
	if(galaxyMove == true) return;

	var curLeft = $('#listContainer').css('left');
	if (typeof(curLeft) == 'undefined') {
		curLeft = 0;
	} else {
		curLeft = +curLeft.replace('px','');
	}
	var move = curLeft + step;
	if( (curLeft + step) > maxLeft) {
		move = minLeft;
	}

	var curPos = Math.abs(move / step);
	$('#solarRightPos').html(slidesArrowText[curPos].right);
	$('#solarLeftPos').html(slidesArrowText[curPos].left);

	galaxyMove = true;
	$("#listContainer").animate({
        left: move + "px"
	}, 1500, null, function() {
      	galaxyMove = false;
	});
}

function galaxyScrollRight() {
	if (galaxyMove == true) return;

	var curLeft = $('#listContainer').css('left');
	if (typeof(curLeft) == 'undefined') {
		curLeft = 0;
	} else {
		curLeft = +curLeft.replace('px','');
	}
	var move = curLeft - step;
	if ((curLeft - step) < minLeft) {
		move = maxLeft;
	}

	var curPos = Math.abs(move / step);
	$('#solarRightPos').html(slidesArrowText[curPos].right);
	$('#solarLeftPos').html(slidesArrowText[curPos].left);

	galaxyMove = true;
	$("#listContainer").animate({
        left: move + "px"
	}, 1500, null, function() {
      	galaxyMove = false;
	});
}


function squareInfo(c1, c2, c3) {
	if(MouseOverFix == 1) {
		return;
	}
	MouseOverFix=1;

	UnTip();

	//Planet
	if(isset(squaresInfo[c1]) && isset(squaresInfo[c1][c2]) && isset(squaresInfo[c1][c2][c3])) {
		Tip(squaresInfo[c1][c2][c3]);
	} else {
		Tip('<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/tooltip_loading.gif" border="0px" alt="Loading" style="padding: 10px;"/>');
		$.post("ajax_info.php",{
			type:'squareInfo',
			c1: c1,
			c2: c2,
			c3: c3
		}, function(response){
			if( response != "" ) {
				squaresInfo[c1] = squaresInfo[c1] || {};
				squaresInfo[c1][c2] = squaresInfo[c1][c2] || {};
			    squaresInfo[c1][c2][c3] = response;
			    Tip(squaresInfo[c1][c2][c3]);
			}
		});
	}
	MouseOverFix=0;
	return true;
}

function sunInfo(day,energy) {
	if(MouseOverFix == 1) return;
	MouseOverFix=1;
	UnTip();
	Tip(
	'<dl class="planetInfo">' +
	'<dd><small>' + LangString.Day + ':</small>' + day + '</dd>' +
	'<dd><small>' + LangString.Energy + ':</small>' + energy + '</dd>'+
	'</dl>');
	MouseOverFix=0;
}

function hidePlayerInfo() {
	UnTip();
}

function moveUp(type) {
	//localStorage.clear();
	try {
	  localStorage.removeItem('expiretime');
	  localStorage.removeItem('positions');
	}
	catch(err) {}
	var value = $('#' + type).val();
	if(isNaN(value)) {
		$('#' + type).val('0');
		return;
	}
	if(value >= maxCoords[type]) {
		return;
	}
	$('#' + type).val(++value);
	refreshGalaxy();
}

function moveDown(type) {
	//localStorage.clear();
	try {
	  localStorage.removeItem('expiretime');
	  localStorage.removeItem('positions');
	}
	catch(err) {}
	var value = $('#' + type).val();
	if(isNaN(value)) {
		$('#' + type).val('0');
		return;
	}
	if(value == 0) {
		return;
	}
	$('#' + type).val(--value);
	refreshGalaxy();
}

function showGlobalNews(){

}

function showRecycleLocations(page){
    $.post('ajax_galaxy.php', {
        recycle: true,
        page: (page!==undefined ? page : '')
      }, function(response) {
          if( response == '' ) {
              showDialogMessage( msgs['no_near_scrap'] );
              return;
          } else {
              $("#dialogBox").html(response);
              $("#dialogMessage").fadeIn(JQ_ANIMATION_SPEED);
          }
    });
}