var danger = 0;
var pic_id='';
var pos_x=0;
var pos_y=0;
var cursorWidth=0;
var cursorHeight=0;
var countBuild = 0;
var $target=$('#drawArea');
var $cursor=$('#cursor');
var toolTipType = 0;
var toolTipQueHolder = new Array();
var LastAjaxRequest = 0;
var tempPlayerBuildingsPosition = new Array();
var moveing = false;

jQuery(document).ready(function(){
	
	$target.bind("mousemove", function(e){
			pos_x = e.pageX - $($target).offset().left - (cursorWidth/2);
			pos_y = e.pageY - $($target).offset().top - (cursorHeight/2);

			if(pos_x < 1) pos_x=0;
			if(pos_y < 1) pos_y=0;

			if(pos_x+cursorWidth > 720) pos_x = 720 - cursorWidth;
			if(pos_y+cursorHeight > 500) pos_y = 500 - cursorHeight;

			if(pic_id != '') {
				$cursor.css({left: pos_x, top: pos_y});
				
				zIndex = (pos_y*1) + (cursorHeight*1);
	 			$cursor.css('z-index',zIndex);
	 			
				UnTip();
				point_it();
			}

			if(toolTipType > 1) { /*global*/
				UnTip();
				toolTipType = 0;
			}
	});

	$("#buildingsList dd").bind("mouseenter", function(e){
        ToolTipCheck(this.id);
    });

    $("#buildingsList dd").bind("mouseout mouseleave click", function(e) {
    	if(document.getElementById('buildingDialogToolTip')) {
    		document.getElementById('buildingDialogToolTip').style.display = 'none';
    	}
    	UnTip();
	});
	
	refreshTimers();
});

function point_it(){
	var tmpRaceId = BuildingsInfo[pic_id].race_id;
	
	if(strongBuildingPosition[tmpRaceId][pic_id].left != 0 && strongBuildingPosition[tmpRaceId][pic_id].top != 0) return;
	
	var temp_x = pos_x + BuildingsDimention[tmpRaceId][pic_id].x;
	var temp_y = pos_y + BuildingsDimention[tmpRaceId][pic_id].y;
	var danger = 0;

	for(i=0;i<blocks[type_zone].length;i++) {
		if(temp_x < (blocks[type_zone][i][2] + blocks[type_zone][i][0]) &&
		   temp_x > (blocks[type_zone][i][0] - BuildingsDimention[tmpRaceId][pic_id].width) &&
		   temp_y > (blocks[type_zone][i][1] - BuildingsDimention[tmpRaceId][pic_id].height) &&
		   temp_y < (blocks[type_zone][i][3] + blocks[type_zone][i][1])) {
			danger=1;
			if($cursor.css('backgroundImage') != "url(" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + pic_id + "-0.png)") {
				$cursor.css({backgroundImage:"url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + pic_id + "-0.png')"});
			}
			return;
	    }
	}

	if(playerBuildings.length > 0 )  {
		for(i=0;i<playerBuildings.length;i++) {
			if(pic_id == playerBuildings[i]['id'] && tmpRaceId == playerBuildings[i]['race_id']) {
				continue;
			}
			
			if(temp_x < (playerBuildings[i]['pos_width']  + playerBuildings[i]['pos_left']) &&
			   temp_x > (playerBuildings[i]['pos_left']   - BuildingsDimention[tmpRaceId][pic_id].width) &&
			   temp_y > (playerBuildings[i]['pos_top']    - BuildingsDimention[tmpRaceId][pic_id].height) &&
			   temp_y < (playerBuildings[i]['pos_height'] + playerBuildings[i]['pos_top'])) {
				danger = 1;
				if($cursor.css('backgroundImage') != "url(" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + pic_id + "-0.png)") {
					$cursor.css({backgroundImage:"url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + pic_id + "-0.png')"});
				}
				return;
	    	}
		}
	}
	if($cursor.css('backgroundImage') != "url(" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + pic_id + "-1.png)") {
		$cursor.css({backgroundImage:"url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + pic_id + "-1.png')"});
	}
	
}

function dbClick(obj) {
	UnTip();
	$cursor.css({display:'none'});
	pic_id = obj;
	pos_x = strongBuildingPosition[RACE_ID][pic_id].dblleft;
	pos_y = strongBuildingPosition[RACE_ID][pic_id].dbltop;
	cursorWidth =BuildingsDimention[RACE_ID][obj].divWidth;
	cursorHeight=BuildingsDimention[RACE_ID][obj].divHeight;
	map_click();
	pic_id="";
	$cursor.css({display:'none'});
}

function change_cursor(obj) {
	UnTip();
	if(BuildingsInfo[obj].current_level > 0) {
		next_level(obj);
		return true;
	}
	if(pic_id != '' && pic_id == obj) {
		pic_id="";
		$cursor.css({display: 'none'});
		return;
	} else if(pic_id == '' || (pic_id != '' && pic_id != obj)) {
		$cursor.css({
			backgroundImage: (obj < 24? "url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + TMP_RACE_ID + "/" + type_zone + obj + "-1.png')": "url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/galaxyzone/" + obj + ".png')"),
			width: BuildingsDimention[TMP_RACE_ID][obj].divWidth+'px',
			height: BuildingsDimention[TMP_RACE_ID][obj].divHeight + 'px',
			display: 'block'
		});
		pic_id=obj;
		cursorWidth=BuildingsDimention[TMP_RACE_ID][obj].divWidth;
		cursorHeight=BuildingsDimention[TMP_RACE_ID][obj].divHeight;
		
		// Tutorial arrow show
		dropZoneTop = strongBuildingPosition[RACE_ID][pic_id].top;
		dropZoneLeft = strongBuildingPosition[RACE_ID][pic_id].left;
		
		if (dropZoneLeft > 0 && dropZoneTop > 0) {
			dropZoneTop += $('#drawArea').offset().top;
			dropZoneLeft += $('#drawArea').offset().left;
			tutorialArrow.init({top: dropZoneTop - 25, left: dropZoneLeft}, 'buildZoneArrow');
			tutorialArrow.show(true);
		}
	}
}

function next_level(buildingId) {
	UnTip();
	if(toolTipType == 100) { /*global*/
		return false;
	}
	
	if(BuildingsInfo[buildingId].current_level <= 0) {
		change_cursor(buildingId);
		return true;
	}
	

	$('#disableLeftMenu').show();

	$.post("ajax_buildings.php", {obj: buildingId, type:2, race_id: BuildingsInfo[buildingId].race_id}, function(response){
		
		$('#disableLeftMenu').hide();
		
		var info = eval('(' + response + ')');

		var handler =
		'<div id="buildingDialog">' +
        '	<div class="title">' +
		'		<div class="thumbnail">' +
        '			<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/buildings/' + ( buildingId < 24 ?'race' + BuildingsInfo[buildingId].race_id + '/' + 'thumb_' + type_zone + buildingId + '.jpg"':'galaxyzone/thumb_' + buildingId + '.jpg"') + '/></div>' +
        '       <div class="details">' +
        (typeof(toolTipQueHolder[buildingId]) == 'undefined' && buildingId <= 23 && BuildingsInfo[buildingId].race_id == RACE_ID ?'    <a href="javascript:void(0);" class="destroyLevel" onclick=\'showConfirm("' + LangString.DesrtoyConfirm + '", function(event){  hideDialog("slow",function(){destory_level(' + buildingId + ')}); });return false;\'>' + LangString.Desrtoy + '</a>':'') +
		'			<span class="buildingName"><a href="information.php?type=building&id=' + buildingId + '">' + BuildingsInfo[buildingId].name + '</a></span>' +
        '           <span class="buildingDescription">' + BuildingsInfo[buildingId].desc + '</span>' +
        '           <ul class="buildingLevels">'+
        '               <li>' + LangString.CurrentLevel + ': <strong>' + info.current_level + '</strong></li>'+
        '               <li>' + LangString.MaxLevel + ': <strong>' + BuildingsInfo[buildingId].max_level + '</strong></li>' +
        (BuildingsInfo[buildingId].current_level < BuildingsInfo[buildingId].max_level ?
        '              <li>' + LangString.NextLevel + ': <strong>' + ((info.current_level*1) + 1) + '</strong></li>':"") +
        '           </ul>' +
        '       </div>' +
        '    </div>' +
        (buildingId < 8?
	        '   <div class="income">' +
	        '       <ul>' +
	        '           <li><small>' + LangString.CurrentIncome + ':</small> <strong>' + number_format(info.CurrentIncome) + ' ' + LangString.PerHour + '</strong></li>' +
		    (info.NextIncome > 0 ? '           <li><small>' + LangString.NextLevel + ':</small> <strong>' + number_format(info.NextIncome) + ' ' + LangString.PerHour + '</strong></li>' : '') +
	        '       </ul>' +
	        '    </div>':'') +
            '<div class="buildingInfo">' +
        (BuildingsInfo[buildingId].current_level < BuildingsInfo[buildingId].max_level ?
        '    <div class="buildNextLevel">' +
        '       ' + LangString.BuildingNextLevel + ': <strong>' + SecToTime(info.time) + '</strong>' +
        '       <ul class="resourcesList">' +
        '           <li class="metal" title="' + LangString.NeededMetal + '">' + info.metal + '</li>' +
        '           <li class="crystal" title="' + LangString.NeededCrystal + '">' + info.crystal + '</li>' +
        '           <li class="gas" title="' + LangString.NeededGas + '">' + info.gas + '</li>' +
        '           <li class="energy" title="' + LangString.NeededEnergy + '">' + info.energy + '</li>' +
					(buildingId == 27 && ENDLESS_MODE == 1 ? '<li class="sunOrbs" title="' + LangString.NeededSunOrbs + '">' + info.sunOrbs + '</li>':'') +
        '       </ul>' +
        '   </div>' +
        '   <div class="buildingQueue">' +
        (typeof(toolTipQueHolder[buildingId]) != 'undefined'?toolTipQueHolder[buildingId]:'') +
        '   </div>':'') +
        '  </div>' +
        '</div>' +
        (info.reason != '' && typeof(info.reason) != 'undefined' ? '<div class="dialogError">' + info.reason + '</div>':'') +
        '<div class="enterBuilding">' +
		' <a href="' + info.url + '" class="button">' +
		'   ' + LangString.GoTo + ' <strong>' + ((type_zone==1)?LangString.ResourceInfo:BuildingsInfo[buildingId].name) + '</strong>' +
		' </a>' +
		'</div>' +
        '<div class="dialogButtons">' +
        (info.reason == ''?'<input type="submit" value="' + LangString.BuildLevel + ' ' + (BuildingsInfo[buildingId].current_level+1) + '" id="buildButton" onclick=\'$(this).attr("disabled", "disabled");hideDialog("slow",function(){upgrade_level(' + buildingId + ')});\' />':'') +
        (buildingId > 7 && buildingId < 24?
        '    <input type="submit" value="' + LangString.Move + '" onclick=\'hideDialog();moveBuilding(' + buildingId + ');\' class="special" />'
        :"") +
		'    <input type="submit" value="' + LangString.Close + '" onclick=\'hideDialog();\' />' +
        
        '</div>';
        toolTipType = 2; /*global*/

        $("#dialogBox").html(handler);
		$("#dialogMessage").fadeIn("slow");
	});
	return;
}

function upgrade_level(buildingId){
	//AudioManager.play.processStart();
	UnTip();
	$('#disableLeftMenu').show();
	
	$.post("ajax_buildings.php", {obj: buildingId,type:3,type_zone:type_zone}, function(response){
		$('#disableLeftMenu').hide();
		$("#buildButton").removeAttr("disabled");
		if(response != 'ok') {
			showDialogMessagePopup(response);
			return;
		}
		BuildingsInfo[buildingId].current_level++;
		TitleArray[buildingId] = "";
		refreshBuildingsPicture(buildingId);
		refreshTimers();
		refreshSession('planet');
		globalQueueLoad();
	});
}

function destory_level(buildingId) {
	UnTip();
	
	if(BuildingsInfo[buildingId].current_level == 0) {
		return false;
	}
	
	$('#disableLeftMenu').show();
	$.post("ajax_buildings.php", {obj: buildingId,type:8}, function(response){
		$('#disableLeftMenu').hide();
		if(response != 'Error!') {
			BuildingsInfo[buildingId].current_level--;

			if(BuildingsInfo[buildingId].current_level == 0) {
				// Remove the visual stuff for this building
				$("#playerB-" + buildingId).remove();
				
				// Remove the playerBuildings elemt for this building
				for (i in playerBuildings) {
					if (playerBuildings[i]['id'] == buildingId) {
						playerBuildings.splice(i, 1);
					}
				}
			}

			TitleArray[buildingId] = "";

			refreshBuildingsPicture(buildingId);
			refreshTimers();
			refreshSession('planet');
			if (buildingId < 8) {	// Some kind of mine
				firePremiumPopupEvent('resourceIncomeChange');
			}
			
		}
		showDialogMessage(response);
		globalQueueLoad();
	});
}

function moveBuilding(buildingId) {
	UnTip();
	
	var tmpRaceId = BuildingsInfo[buildingId].race_id;
	
	if(pic_id == '' || pic_id != buildingId) {
		$cursor.css({
			backgroundImage: "url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + tmpRaceId + "/" + type_zone + buildingId + "-1.png')",
			width: BuildingsDimention[tmpRaceId][buildingId].divWidth+'px',
			height: BuildingsDimention[tmpRaceId][buildingId].divHeight + 'px',
			display: 'block'
		});
		pic_id=buildingId;
		cursorWidth=BuildingsDimention[tmpRaceId][buildingId].divWidth;
		cursorHeight=BuildingsDimention[tmpRaceId][buildingId].divHeight;
		$('#playerB-' + buildingId).hide();
		moveing = true;
	}
}

function map_click(){
	UnTip();
	
	if(pic_id == "") {
		return false;
	}
	
	var buildingId = pic_id;
	var buildingRaceId = BuildingsInfo[buildingId].race_id;
	
	pic_id = "";
	posX=pos_x;
	posY=pos_y;

	if(danger == 1) {
		$("#dialogBox").html('<p>' + LangStrings.locationError + '</p><div class="dialogButtons"><input type="button" value="Ok" onclick=\'hideDialog();\' /></div>');
		$("#dialogMessage").fadeIn("slow");
		return;
	}

	if(moveing == true) {
		$.post("ajax_buildings.php", {
				obj: buildingId,
				x: posX,
				y: posY,
				type: 9,
				race_id: BuildingsInfo[buildingId].race_id,
				type_zone: type_zone
		}, function(response){
			
			for(i=0;i<playerBuildings.length;i++) {
				if(buildingId == playerBuildings[i]['id'] && buildingRaceId == playerBuildings[i]['race_id']) {
					playerBuildings[i]['pos_left'] = (playerBuildings[i]['pos_left'] - playerBuildings[i]['left']) + posX;
					playerBuildings[i]['pos_top'] = (playerBuildings[i]['pos_top'] - playerBuildings[i]['top']) + posY;
					
					playerBuildings[i]['left'] = posX;
					playerBuildings[i]['top'] = posY;
				}
			}
			
			if(response != 'ok') {
				pic_id = buildingId;
				showDialogMessage(response);
			} else {
				moveing = false;
				$("#cursor").hide();
				$('#playerB-' + buildingId).css({left: posX +'px',top: posY+ 'px'});
				$('#playerB-' + buildingId).show();
				refreshTimers();
			}
		});
		return;
	}
	
	$('#disableLeftMenu').show();
	if(strongBuildingPosition[RACE_ID][buildingId].left!=0 && strongBuildingPosition[RACE_ID][buildingId].top!=0) {
		posX = strongBuildingPosition[RACE_ID][buildingId].left;
		posY = strongBuildingPosition[RACE_ID][buildingId].top;
		
		$("#cursor").animate({
			top: strongBuildingPosition[RACE_ID][buildingId].top + "px",
			left: strongBuildingPosition[RACE_ID][buildingId].left +"px"
		}, 'fast',null,function() {
			if(buildingId > 23) {
				$('#crystalGroup' + buildingId).hide();
				if(buildingId == 27) {
					$('#playerB-24').hide();	
					$('#playerB-25').hide();	
					$('#playerB-26').hide();	
				}
			}
			$.post("ajax_buildings.php",
					{
						obj: buildingId,
						x: posX,
						y: posY,
						type: 1,
						type_zone: type_zone,
						race_id: buildingRaceId
					},
					function(response){
						ajaxRespond(buildingId,response,posX,posY);
						globalQueueLoad();
					});
		});
	} else {
		$.post("ajax_buildings.php",
				{
					obj: buildingId,
					x: posX,
					y: posY,
					type: 1,
					type_zone: type_zone,
					race_id: buildingRaceId
				},
				function(response){
					ajaxRespond(buildingId,response,posX,posY);
					globalQueueLoad();
				});
	}

}

function ajaxRespond(buildingId,response,posX,posY) {
	$('#disableLeftMenu').hide();
	$cursor.css({display: 'none'});
	if(response != 'ok') {
		showDialogMessagePopup(response);
		return;
	}
	
	// Hide tutorial arrow on the map
	tutorialArrow.hide('buildZoneArrow');
	
	var newdiv = document.createElement('div');
	newdiv.setAttribute('id','playerB-' + buildingId);
	$(newdiv).css({
			backgroundImage: (buildingId < 24? "url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + BuildingsInfo[buildingId].race_id + "/" + type_zone + buildingId + "-1.png')": "url('" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/galaxyzone/" + buildingId + ".png')"),
			width: cursorWidth + 'px',
			height: cursorHeight + 'px',
			left: posX + 'px',
			top: posY + 'px',
			display: 'block',
			position: 'absolute',
			zIndex: buildingId,
			visibility: "visible",
			cursor: 'pointer'
	});
	$(newdiv).click(function () {next_level(buildingId);});



	var timerdiv = document.createElement('div');
	timerdiv.setAttribute('id','BuildingTimerHolder-' + buildingId);

	newdiv.appendChild(timerdiv);
	document.getElementById('drawArea').appendChild(newdiv);


	BuildingsInfo[buildingId].current_level++;
	
	
	countBuild++;
	
	var dimInfo = BuildingsDimention[BuildingsInfo[buildingId].race_id][buildingId];
	playerBuildings.push({'id':buildingId, 'race_id': BuildingsInfo[buildingId].race_id, 'left': posX,'top': posY, 'width': cursorWidth, 'height': cursorHeight, 'pos_left': (dimInfo.x + posX), 'pos_top': (dimInfo.y + posY), 'pos_width': dimInfo.width, 'pos_height': dimInfo.height});
	$cursor.css({display: 'none'});
	
	refreshTimers();

	refreshSession('planet');
}

function buildingDone(buildingId) {
	$.post("ajax_buildings.php", {type: 5}, function(response){
		if (buildingId < 8) { // Some kind of mine
			firePremiumPopupEvent('resourceIncomeChange');
		}
	});
}

function ToolTipCheck(buildingId) {
	if(TitleArray[buildingId] == '') {
		Tip('<div id="buildingDialogToolTip" style="display:block;background:#000000;"><center><img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/loading_building.gif' + '" border="0" /></center></div>');
		LastAjaxRequest = buildingId;
		
		$.post("ajax_buildings.php", {obj: buildingId,type:2,race_id: BuildingsInfo[buildingId].race_id}, function(response){
			$('#disableLeftMenu').hide();
			if(LastAjaxRequest != buildingId) return;
			var info = eval('(' + response + ')');

			TitleArray[buildingId]=
			'<div id="buildingDialog" style="display:block;">' + 
	        '	<div class="title">' +
			'		<div class="thumbnail">' +
			(buildingId < 24?
            	'			<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/buildings/race' + BuildingsInfo[buildingId].race_id + '/' + 'thumb_' + type_zone + buildingId + '.jpg" /></div>'
            :
            	'			<img src="' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/buildings/galaxyzone/thumb_' + buildingId + '.jpg" /></div>'
            ) +
	        '       <div class="details">' +
			'			<span class="buildingName"><a href="information.php?type=building&id=' + buildingId + '">' + BuildingsInfo[buildingId].name + '</a></span>' +
	        '           <span class="buildingDescription">' + BuildingsInfo[buildingId].desc + '</span>' +
	        '           <ul class="buildingLevels">'+
	        '               <li>' + LangString.CurrentLevel + ': <strong>' + BuildingsInfo[buildingId].current_level + '</strong></li>'+
	        '               <li>' + LangString.MaxLevel + ': <strong>' + BuildingsInfo[buildingId].max_level + '</strong></li>' +
	        (BuildingsInfo[buildingId].current_level != BuildingsInfo[buildingId].max_level?
	        '               <li>' + LangString.NextLevel + ': <strong>' + (BuildingsInfo[buildingId].current_level+1) + '</strong></li>':"") +
	        '           </ul>' +
	        '       </div>' +
	        '    </div>';
	        if(buildingId < 8) {
		        TitleArray[buildingId]+=
		        '   <div class="income">' +
		        '       <ul>' +
		        '           <li><small>' + LangString.CurrentIncome + ':</small> <strong>' + number_format(info.CurrentIncome) + ' ' + LangString.PerHour + '</strong></li>' +
		        (BuildingsInfo[buildingId].current_level < BuildingsInfo[buildingId].max_level?
		        	'           <li><small>' + LangString.NextLevel + ':</small> <strong>' + number_format(info.NextIncome) + ' ' + LangString.PerHour + '</strong></li>':"")+
		        '       </ul>' +
		        '    </div>';
	        }
		    if(BuildingsInfo[buildingId].current_level < BuildingsInfo[buildingId].max_level) {
		        TitleArray[buildingId]+=
		        '    <div class="buildNextLevel">' +
		        '       ' + LangString.BuildingNextLevel + ': <strong>' + SecToTime(info.time) + '</strong>' +
		        '       <ul class="resourcesList">' +
		        '           <li class="metal" title="' + LangString.NeededMetal + '">' + info.metal + '</li>' +
		        '           <li class="crystal" title="' + LangString.NeededCrystal + '">' + info.crystal + '</li>' +
		        '           <li class="gas" title="' + LangString.NeededGas + '">' + info.gas + '</li>' +
		        '           <li class="energy" title="' + LangString.NeededEnergy + '">' + info.energy + '</li>' +
				(buildingId == 27 && ENDLESS_MODE == 1 ? '<li class="sunOrbs" title="' + LangString.NeededSunOrbs + '">' + info.sunOrbs + '</li>':'') +
		        '       </ul>' +  
				(BuildingsInfo[buildingId].current_level <= 0 && (info.reason == '' || typeof(info.reason) == 'undefined') ? '<div class="buildingInfoDBClickTip">' + LangString.DBClickTip + '</div>':'') +
		        '   </div>' +
		        (info.reason != '' && typeof(info.reason) != 'undefined'? '<div class="dialogError">' + info.reason + '</div>':'') +
		        '</div>';
		    } else {
		    	TitleArray[buildingId]+=
		        '   <div class="buildNextLevel">' +
		        '<br /><strong>' + info.reason + '</strong><br /><br /><br />' +
		        '   </div>' +
		        '</div>';
		    }
		    
	        if(document.getElementById('buildingDialogToolTip')) {
	        	$('#buildingDialogToolTip').css('widht','500px');
	        	$('#buildingDialogToolTip').html(TitleArray[buildingId]);
	        }
		});
	} else {
		Tip('<div id="buildingDialogToolTip" style="display:block;widht: 500px;">' + TitleArray[buildingId] + '</div>');
	}
}

function boostProcessBuilding(processId) {
	new ProcessesBoosterManager().showApplyConfirm('buildings', processId, function() {
		refreshTimers();
		globalQueueLoad();
	});
}

function cancelBuilding(processId,buildingId) {
    /*global*/ toolTipType = 100;
    $.post("ajax_buildings.php", {processId: processId,type:6,zone: type_zone}, function(response){
    		BuildingsInfo[buildingId].current_level-= response;
    		
            if(BuildingsInfo[buildingId].current_level == 0) {
            		// Remove the visual stuff for this building
                    $('#playerB-' + buildingId).remove();
                    
                    // Remove the playerBuildings elemt for this building
    				for (i in playerBuildings) {
    					if (playerBuildings[i]['id'] == buildingId) {
    						playerBuildings.splice(i, 1);
    					}
    				}
    				
                    if(buildingId > 23) {
                    	$('#crystalGroup' + buildingId).show();
                    }
            }
            
            TitleArray[buildingId] = "";
            refreshBuildingsPicture(buildingId);
            refreshTimers();
            refreshSession('planet');

            toolTipType = 0;
			globalQueueLoad();
    });
    return false;
}

function timerFinish(elementName,mainName,bId) {
	$('#' + elementName).slideUp('slow',function(){
		buildingDone(bId);
		refreshTimers();
	});
}

function refreshBuildingsPicture(buildingId) {
	if(buildingId > 23) {
		$('#BuildingImageHolder-' + buildingId).html("<img src=\"" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/galaxyzone/" + buildingId + ".png\" border=\"0\" />");
		return;
	}
	$.post("ajax_buildings.php", {
		type: 7,
		buildingId: buildingId,
		level: BuildingsInfo[buildingId].current_level,
		race_id: BuildingsInfo[buildingId].race_id
	}, function(picture_id){
		$('#BuildingImageHolder-' + buildingId).html("<img src=\"" + GLOBAL_HTTP_PATH_IMAGES + "img/v2.0/img/buildings/race" + BuildingsInfo[buildingId].race_id + "/" + type_zone + buildingId + "-" + picture_id + ".png\" border=\"0\" usemap=\"#Map" + buildingId + "-" + picture_id + "\" />");
	});
	
}

function refreshTimers() {
	$.post("ajax_buildings.php", {
		type: 4,
		type_zone: type_zone,
		race_id: TMP_RACE_ID
	}, function(xml){
		var info = eval('(' + xml + ')');

		Timers=new Array();
		CountTimers=0;
		toolTipQueHolder = new Array();
		var zIndex = 0;
		
		for (var obj in BuildingsInfo){
 			$("#BuildingTimerHolder-"+ obj).html("");

 			if(document.getElementById("playerB-" + obj)) {
	 			var cssTop = $("#playerB-" + obj).css('top');
	 			if(typeof(cssTop) == 'undefined') cssTop = 0;
	 			var cssHeight = $("#playerB-" + obj).css('height');
	 			if(typeof(cssHeight) == 'undefined') cssTop = 0;
	 			cssTop = cssTop.replace('px','');
	 			cssHeight = cssHeight.replace('px','');
	 			zIndex = (cssTop*1) + (cssHeight*1);
	 			
	 			$("#playerB-" + obj).css('z-index',zIndex);
 			}
		}

		for(var i=0;i<info.length;i++) {
			if(info[i].bId != 0) {
				if(document.getElementById("playerB-" + obj)) {
					var cssTop = $("#playerB-" + obj).css('top');
					if(typeof(cssTop) == 'undefined') cssTop = 0;
		 			var cssHeight = $("#playerB-" + obj).css('height');
		 			if(typeof(cssHeight) == 'undefined') cssTop = 0;
		 			cssTop = cssTop.replace('px','');
		 			cssHeight = cssHeight.replace('px','');
		 			zIndex = (cssTop*1) + (cssHeight*1);
					
					$("#playerB-" + info[i].bId).css('z-index',(10000-zIndex));
				}
				$("#BuildingTimerHolder-"+ info[i].bId).html(info[i].html);
				toolTipQueHolder[info[i].bId] = info[i].tooltip;
			}
		}
		return ;
	});
}

function SmallToolTip(buildingId) {
	toolTipType = 1; // Global
	var tipString = '';
	tipString += '<span style="font-weight: bold">' + BuildingsInfo[buildingId].name + '</span>';
	tipString += '<br />';
	tipString += LangString.CurrentLevel + ': ' + BuildingsInfo[buildingId].current_level;
	tipString += '<br />';
	tipString += BuildingsInfo[buildingId].desc;
	
	Tip(tipString);
	return;
}
