$(document).ready(function() { 
	// this fix the jQuery bug for {.replace is not a function}
	$('.ships').val('0');
	showFleets();
	fleetsAddChangeListeners();
	fleetsUpdatePopDisplay();
});

let fleetTimers = {};

function showFleets() {
	Timers=new Array();
	CountTimers=0;
	
	var espionagePanelAction = 'hide';
	if ($('.espionageClass').length > 0 && $('.espionageClass').css('display') != 'none') {
		espionagePanelAction = 'show';
	}
	
	$('#fleetHandler').load("ajax_fleets.php?type=showFleets&espionagePanel=" + espionagePanelAction + "&rnd=" + Math.random(999999));
	$.post("ajax_fleets.php",{
		type:'maxFleets',
		jsonEncode: 1
	}, function(response){
		var info = eval('(' + response + ')');
	    $('#FleetsCount').html(info.count);
	    $('#MaxFleets').html(info.max);
	});
}

function espionageToggle(type) {
	if (type == 'hide' && $('.espionageClass').css('display') != 'none') {
		$('#hideEspionage').hide();
		$('#showEspionage').show();
		$('.espionageClass').hide();
	} else {
		$('#hideEspionage').show();
		$('#showEspionage').hide();
		$('.espionageClass').show();
	}
}

function processSpy(fleet_id) {
	$.post("ajax_fleets.php",{
		type:'processSpy',
		fleet_id: fleet_id
	}, function(response){
		var info = eval('(' + response + ')');
		showDialogMessage(info.message);
		if (info.status == true && info.locked == false) {
			showFleets();
		}
	});
}

function destroyAllSpies() {
	$.post("ajax_fleets.php",{
		type:'destroyAllSpies'
	}, function(response){
	    showFleets();
	});
}

function destroySelectedSpies() {
	
	var data = '';
	$("input[name^='spySelect']:checked").each(function(i) {
		if ($(this).val()) {
			data += $(this).val() + ',';
		}
	});
	
	$.post("ajax_fleets.php",{
		type:'destroySelectedSpies',
		spies: data
	}, function(response){
	    showFleets();
	});
}

function destroySpyById(spyId) {
	$.post("ajax_fleets.php",{
		type:'destroySelectedSpies',
		spies: spyId + ','
	}, function(response){
	    showFleets();
	});
}

function returnFleet(fleet_id) {
	$.post("ajax_fleets.php",{
		type:'returnFleet',
		fleet_id: fleet_id
	}, function(response){
	    if(response == 'true') {
	    	showFleets();
	    }
	});
}

function loadShips() {
	$.post("ajax_fleets.php",{
		type:'ships'
	}, function(response){
	    $('#TabChooseShips').html(response);
	});
}

function shipsCheck() {
	var postVars ="type=shipsCheck&";
	
	$('.ships').each(function(){
		if(($(this).val()*1) > 0)
			postVars+=this.name + "=" + $(this).val() + "&";
	})
	
	postVars+="mission=" + $('#mission').val();

	$.post("ajax_fleets.php",postVars, function(response){
		var info = eval('(' + response + ')');
		var scrapMotivationFleetsList = SCRAP_MOTIVATION_FLEETS.split(',').map(function(x) {
			return parseInt(x);
		});
		
		if(info.pass == '0') {
			showDialogMessage(info.info);
			return false;
		} else {
			resetFlightSendForm();
			
			var miss = document.getElementById('mission'); //jQuery SUX !!!
			$('#missionName').html(miss.options[miss.selectedIndex].innerHTML);
			$('#missionCargo').html(info.cargo + '');
			$('#missionCargoDisp').html(number_format(info.cargo) + '');
			$('#missionLoad').html(info.cargo + '');
			$('#missionLoadDisp').html(number_format(info.cargo) + '');
			$('#missionSpeed').html(info.speed + '');
			$('#admiralTimeBonus').html(info.admiral_bonus);
			$('#admiralEquipmentTimeBonus').html(info.admiral_equipment_bonus);
			$('#csTimeBonus').html(info.cs_bonus);
			$('#missionSpeedDisp').html(number_format(info.speed) + '');
			$('#missionPopCounter').html(info.population + '');
			$('#missionPopCounterDisp').html(number_format(info.population) + '');
			$('#energy_percent').val(info.energy_percent + '');
			$('#fuel').val(info.fuel + '');
						
			if ($('#mission').val() == 2 || $('#mission').val() == 5 || $('#mission').val() == 7 || $('#mission').val() >= 10) {
				$('#myPlanetsDropDown').hide();
			}
			
			if($('#mission').val() == 11 || $('#mission').val() == 14) {
				$('#RowMotivation').hide();
			}
			
			if ($.inArray(parseInt($('#mission').val()), scrapMotivationFleetsList) < 0) {
				$('#RowScrapMotivation').hide();
			}

			if ($('#mission').val() != 3 && $('#mission').val() != 7 && $('#mission').val() != 12 && $('#mission').val() != 13) {
				$('#battleRounds').hide();
			}
						
			if($('#mission').val() == 10 || $('#mission').val() == 11) {
				$('#target_c3').val('0');
				$('#target_c3').hide();
			} else {
				if($('#target_c3').val() == 0 && $('#mission').val() != 6) {
					$('#target_c3').val($('#my_c3').val());
				}
				$('#target_c3').show();
			}
			
			if ($('#mission').val() == 11 || $('#mission').val() == 14) {
				$('#RowSpeedBoost').hide();
			}
			
			if ($('#mission').val() == 14) {
				$('#RowTargetCoords').hide();
				$('#RowFlightTime').hide();
				$('#RowFlightTimeSelect').show();
				$('#RowDistance').hide();
				$('#RowSpeed').hide();
  	
				$('#target_c1').val($('#my_c1').val());
				$('#target_c2').val($('#my_c2').val());
				$('#target_c3').val($('#my_c3').val());
			} else {
				$('#RowFlightTime').show();
				$('#RowFlightTimeSelect').hide();
			}
						
			if ($('#mission').val() == 10 || $('#mission').val() == 6) {
				$('#rowLoadResources').hide();
			}

			if ($('#mission').val() == 3 || $('#mission').val() == 7) {
				$('#missionInfo').show();
			} else {
				$('#missionInfo').hide();
			}

			showTab('TabSendFleets');
			FlyCheck();
			return true;
		}
	});
}

function resetFlightSendForm() {
	$('#speed_motiv').val(0);
	$('#scrap_motiv').val(0);
	$('#speed').val(10);
	
	$('#RowFlightTimeSelect').show();
	$('#RowFlightTime').show();
	$('#myPlanetsDropDown').show();
	$('#RowTargetCoords').show();
	$('#RowMotivation').show();
	$('#RowScrapMotivation').show();
	$('#RowSpeedBoost').show();
	$('#battleRounds').show();
	$('#RowDistance').show();
	
	$('#loadMetal').val('0');
	$('#loadCrystal').val('0');
	$('#loadGas').val('0');
	$('#loadRecycle').val('0');
	$('#rowLoadResources').show();
}

function SendFleet() {
	var postVars ="type=SendFleet&";
	
	$('.ships').each(function(){
		if(($(this).val()*1) > 0) {
			postVars+=this.name + "=" + $(this).val() + "&";
		}
	})
	
	postVars+="mission=" + $('#mission').val() + "&";
	postVars+="speed=" + $('#speed').val() + "&";
	postVars+="metal=" + $('#loadMetal').val() + "&";
	postVars+="crystal=" + $('#loadCrystal').val() + "&";
	postVars+="gas=" + $('#loadGas').val() + "&";
	postVars+="scrap=" + $('#loadRecycle').val() + "&";
	postVars+="c1=" + $('#target_c1').val() + "&";
	postVars+="c2=" + $('#target_c2').val() + "&";
	postVars+="c3=" + $('#target_c3').val() + "&";
	postVars+="battle_rounds=" + document.getElementById("battle_rounds").options[document.getElementById("battle_rounds").selectedIndex].value + "&";
	postVars+="speed_motivation=" + document.getElementById("speed_motiv").options[document.getElementById("speed_motiv").selectedIndex].value + "&";
	postVars+="scrap_motivation=" + document.getElementById("scrap_motiv").options[document.getElementById("scrap_motiv").selectedIndex].value + "&";
	postVars+="flight_hours=" + document.getElementById("flight_hours").options[document.getElementById("flight_hours").selectedIndex].value + "&";
	postVars+="flight_minutes=" + document.getElementById("flight_minutes").options[document.getElementById("flight_minutes").selectedIndex].value;
	
	
	
	$.post("ajax_fleets.php",postVars, function(response){
		var info = eval('(' + response + ')');
		$('#SendFleetButton').removeAttr("disabled");
		if(info.pass == '0') {
			showDialogMessagePopup(info.info);
			return false;
		} else {
			refreshShips();
			showTab('TabChooseShips');
			showFleets();
			refreshSession('session');
			return true;
		}
	});
	
}

function refreshShips() {
	$.post("ajax_fleets.php",{
		type:'getAvaiableShips'
	}, function(response){
		var ships = eval('(' + response + ')');
		var commanderShips = ships['commanderShips'];
		ships = ships['ships'];
		var buffer='';
	    for(race_id in ships) {
		    for(ship_id in ships[race_id]) {
		    	info = ships[race_id][ship_id];
		    	if(info.count > 0) {
			    	buffer+=
					'<div class="row">' +
					    '<label for="ship_' + race_id + '_' + ship_id + '">' + info.name + ' ( <a href="javascript:void(0)" onclick="$(\'#ship_' + race_id + '_' + ship_id + '\').val(' + info.count + ').trigger(\'change\');"> ' + TRANSLATE_MAX + ' ' + info.count + '</a> ):</label>' +
					    '<div class="right">' +
						    '<input type="hidden" name="ship_' + race_id + '_' + ship_id + '_max" id="ship_' + race_id + '_' + ship_id + '_max" value="' + info.count + '"/>'+
						    '<input type="text" name="ship[' + race_id + '][' + ship_id + ']" id="ship_' + race_id + '_' + ship_id + '" size="3" value="0" class="ships"/>' +
					    '</div>' +
					'</div>';
		    	}
		    }
	    }
	    for(ship in commanderShips) {
	    	info = commanderShips[ship];
	    	if(info.count > 0) {
		    	buffer+=
				'<div class="row">' +
				    '<label for="commanderShip_' + info.id + '">' + info.name + ' ( <a href="javascript:void(0)" onclick="$(\'#commanderShip_' + info.id + '\').val(' + info.count + ').trigger(\'change\');"> ' + TRANSLATE_MAX + ' ' + info.count + '</a> ):</label>' +
				    '<div class="right">' +
					    '<input type="hidden" name="commanderShip_' + info.id + '_max" id="commanderShip_' + info.id + '_max" value="' + info.count + '"/>'+
					    '<input type="text" name="commanderShip[' + info.id + ']" id="commanderShip_' + info.id + '" size="3" value="0" class="ships"/>' +
				    '</div>' +
				'</div>';
	    	}
	    }
	    
	    $('#shipsHolder').html(buffer);
		fleetsAddChangeListeners();
		fleetsUpdatePopDisplay();
	});
}

function fleetsAddChangeListeners() {
	$('input.ships').bind("keyup change", function() {
		fleetsUpdatePopDisplay();
	});
}

function fleetsUpdatePopDisplay() {
	var totalPop = 0;

	$('input.ships').each(function() {
		var unitInfo = $(this).attr('id').split('_');
		var unitType = unitInfo[0];
		var unitsCount = !$(this).val() ? 0 : parseInt($(this).val());

		var perUnitPop = 0;
		if (unitType === 'ship') {
			perUnitPop = parseInt(raceShips[parseInt(unitInfo[1])][parseInt(unitInfo[2])].pop);
		}

		if (unitType === 'commanderShip') {
			perUnitPop = parseInt(csPop[parseInt(unitInfo[1])]);
		}

		totalPop += perUnitPop * unitsCount;
	});

	$('#selectPopulationDisplay').html(number_format(totalPop));
}

function FlyCheck(){
	var missionId = parseInt($('#mission').val());
  	var c1=$('#my_c1').val() * 1;
  	var c2=$('#my_c2').val() * 1;
  	var c3=$('#my_c3').val() * 1;
  	
  	var showTime = 0;
  	
    var bonus = document.getElementById("speed_motiv").options[document.getElementById("speed_motiv").selectedIndex].value;
    
    if (c1 > 0) {
    	a=c1;
    } else {
    	a=0;
    }
    
    if (c2 > 0) {
    	b=c2;
    } else {
    	b=0;
    }
    if (c3 > 0) {
    	c=c3;
    } else {
    	c=0;
    }
	tc1 = $('#target_c1').val()*1;
	tc2 = $('#target_c2').val()*1;
	tc3 = $('#target_c3').val()*1;

	energy_procent = $('#energy_percent').val() * 1;
    curgas = parseInt( PLAYER['gas'] );
	gasv = $('#fuel').val() * 1;
	skorost = $('#missionSpeed').html() * 1;
    p=$('#speed').val()*1;
    admiral_bonus  = $('#admiralTimeBonus').html();
	admiral_equipment_bonus  = $('#admiralEquipmentTimeBonus').html();
    cs_bonus = $('#csTimeBonus').html();

    m=0;
    h=0;
    d="-";
    
    if(a != tc1) {
      d=Math.abs(a-tc1) * 9000;
    }else if(b!=tc2) {
      d=1300+5*Math.abs((b-tc2)*19);
    }
    else if(c!=tc3){
      d=1000+Math.abs((c-tc3)*5);
    }
    
    if(a<1|b<1|b>SOLAR_SYSTEM_MAX_AMOUNT|c<1|c>24){
      d="-";
    }
    
    
	e=Math.round(gasv*d/35000*((p/10)+1)*((p/10)+1))+1;
	
	s=Math.round(35000/p*Math.sqrt(d*10/skorost))+10;
    
	if(c1 == tc1 && c2 == tc2 && c3 == tc3) {
		if(missionId == 8) {
			s = Math.round((20 * 60)/(p/10));  // 20 minutes
			showTime=1;
		}else if(missionId == 6 || missionId == 16) {
			s = Math.round((15 * 60)/(p/10)); // 15 minutes
			showTime=1;
		} else if(missionId == 15) {
			s = Math.round(30 / (p / 10)); // 30 seconds
			showTime = 1;
		}
	}
	
	if (tc3 === 0 && missionId === 6) {
		s = Math.round((600 * 60) / (p / 10)); // 600 minutes
		showTime = 1;
	}

	s = Math.round(s * admiral_bonus);
	s = Math.round(s * admiral_equipment_bonus);
	s -= Math.round(s * cs_bonus);
	
    s = Math.round(s * FLEETS_SPEED);
    
	if(bonus != 0){
		s=Math.round(s - (s*bonus/100));
    }
	
	if($('#mission').val() == 11) {
		s = SUN_ATTACK_TIME; // 48 * 3600 OR 12 * 3600
		s = s - ( s * OBELISK_COUNT);
		s = Math.round(s); // 48 hours
		showTime=1;
	}
	
	s = Math.max(FLEETS_MIN_TIME, s);

        
    if ($('#mission').val() == 14) {
        var flight_hours = $('#flight_hours').val();
        var flight_minutes = $('#flight_minutes').val();
        s = 0;
        if(flight_hours) {
            s += (flight_hours * 60 * 60);
        }
        if(flight_minutes) {
            s += flight_minutes * 60;
        }
    }
        

    m=0;
    h=0;
    m2=0;
    h2=0;
    s2=s*2;
    seconds = s;
    seconds2 = s2;
    
    if(s>59){
      m=Math.floor(s/60);
      s=s-m*60;
    }
    
    if(m>59){
      h=Math.floor(m/60);
      m=m-h*60;
    }

    if(s<10) s="0"+s;
    if(m<10) m="0"+m;
    
    if(s2>59){
      m2=Math.floor(s2/60);
      s2=s2-m2*60;
    }
    
    if(m2>59){
      h2=Math.floor(m2/60);
      m2=m2-h2*60;
    }

    if(s2<10) s2="0"+s2;
    if(m2<10) m2="0"+m2;
    
    
    if(d=="-"){
		$("#missionDistance").html(d);
		if ($('#mission').val() == 14) {
			$("#missionGasNeeded").html(100);
			$("#missionGasNeededDisp").html(100);
                        showTime = 1;
		} else {
			$("#missionGasNeeded").html(d);
			$("#missionGasNeededDisp").html(number_format(d));
		}
		
		if(showTime == 1) {
			$("#missionOneWay").html(h+":"+m+":"+s);
                        $("#missionTwoWay").html(h2+":"+m2+":"+s2);
                        refreshFleetTime(seconds, '#missionOneWayTime', 'fleetTimer1');
                        refreshFleetTime(seconds2, '#missionTwoWayTime', 'fleetTimer2');
		} else {
			$("#missionOneWay").html(d);
                        $("#missionTwoWay").html(d);
		}
    } else {
		e = e * (energy_procent / 100);
		
		if($('#mission').val() == 11) {
			e = e * (SUN_ATTACK_GAS_PERCENT / 100);
		}
		
		e = Math.round(e);
		$("#missionDistance").html(number_format(d * 1000)+" km");
		$("#missionOneWay").html(h+":"+m+":"+s);
                $("#missionTwoWay").html(h2+":"+m2+":"+s2);
                refreshFleetTime(seconds, '#missionOneWayTime', 'fleetTimer1');
                refreshFleetTime(seconds2, '#missionTwoWayTime', 'fleetTimer2');
		$("#missionGasNeeded").html(e);
		$("#missionGasNeededDisp").html(number_format(e));
    }
    
    
    loadedRes();
}

function refreshFleetTime(seconds, el, timer) {
    if(fleetTimers[timer]) {
        clearTimeout(fleetTimers[timer]);
    }
    t = new Date();
    t.setSeconds(t.getSeconds() + seconds);
    var h = t.getHours();
    var m = t.getMinutes();
    var s = t.getSeconds();
    

    if(h < 10) h = 0 + "" + h;
    if(m < 10) m = 0 + "" + m;
    if(s < 10) s = 0 + "" + s;
    
    $(el).html(h+":"+m+":"+s);
    
    fleetTimers[timer] = setTimeout(function() {refreshFleetTime(seconds, el, timer)},1000);
    
}

function sendToMyPlanet(coordinates) {
	var coords = coordinates.split(':');
	$('#target_c1').val(coords[0]);
	$('#target_c2').val(coords[1]);
	$('#target_c3').val(coords[2]);
	FlyCheck();
	return;
}

function loadedRes() {
	var LoadMetal = $('#loadMetal').val() * 1;
    var LoadCrystal = $('#loadCrystal').val() * 1;
    var LoadGas = $('#loadGas').val() * 1;
    var loadRecycle = $('#loadRecycle').val() * 1;
    var Cargo = $('#missionCargo').html() * 1;
    
	needed = Cargo - (LoadMetal + LoadCrystal + LoadGas + loadRecycle);

	$("#missionLoad").html(needed + "");
	$("#missionLoadDisp").html(number_format(needed) + "");
}

function loadMin(type) {
	$('#load' + type).val(0);
	loadedRes();
}

function loadMax(type) {
	
    var typeKey = (''+type).toLowerCase();
    var inStorage = parseInt( PLAYER[typeKey] );
	var cargoAvailable = $("#missionLoad").html() * 1;
	var loadedOfType = $('#load' + type).val() * 1;
    
    if(type == 'Gas' && $("#missionGasNeeded").html() != '-') {
    	inStorage -= parseInt($("#missionGasNeeded").html());
    }
    
	inStorage = Math.max(0, inStorage);

    if(inStorage > cargoAvailable + loadedOfType) {
          $('#load' + type).val(Math.max(cargoAvailable + loadedOfType, 0));
    } else {
          $('#load' + type).val( inStorage );
    }

    loadedRes();
}

function loadMaxAll() {
	loadMax('Metal');
	loadMax('Crystal');
	loadMax('Gas');
	loadMax('Recycle');
}

function loadMinAll() {
	loadMin('Metal');
	loadMin('Crystal');
	loadMin('Gas');
	loadMin('Recycle');
}

function fleetDetails(fleetId) {
	$.post("ajax_fleets.php",{
		type: 'fleetDetails',
		fleet_id: fleetId
	}, function(response){
		floatingEnable = 0;
		showDialogMessagePopup(response, function() {
			floatingEnable = 1;
		});
	});
}

function getSavedReports() {
	$('#SavedReportsHolder').load("ajax_reports.php?type=showOwnReports&rnd=" + Math.random(999999) );
	return true;
}

function getLastReports() {
	$('#LastReportsHolder').load("ajax_reports.php?type=showLastReports&rnd=" + Math.random(999999) );
	return true;
}

function deleteOwnReport(id) {
	$.post("ajax_reports.php",{
		type:'deleteReport',
		del: id
	}, function(response){
		getSavedReports();
	    showDialogMessage(response);
	});
	return true;
}

function ownReport(id) {
	$.post("ajax_reports.php",{
		type:'ownReport',
		own: id
	}, function(response){
		showDialogMessage(response);
		getSavedReports();
	});
}

function Deletesimulate_name() {
	var postVars ="type=DeleteSimulateName&";
	postVars+="name=" + $('#defendername option:selected').text();
	
	$.post("ajax_fleets.php", postVars, function(response){
		//fleetsTableHide(); simulatorLoadData();showTab('TabSimulator');
		//showDialogMessage(response);
		var data = eval('(' + response + ')');
		if(data.pass == '1')
		{
			showDialogMessage(data.info);
			$("#defendername option:selected").remove();
		}
		else
		{
			showDialogMessage(response);
		}
		//localStorage.clear();
		try {
		  localStorage.removeItem('expiretime');
		  localStorage.removeItem('positions');
		}
		catch(err) {}
	});
}

function simulatorSave() {
	var postVars ="type=SaveSimulate&";
	postVars+="savescience_name=" + $('#savescience_name').val() + "&";
	postVars+="science-10=" + $('#defenderScienceLevel-10').val() + "&";
	postVars+="ability-laser=" + $('#defenderAbilityLevel-SkillLaserDamage').val() + "&";
	postVars+="science-11=" + $('#defenderScienceLevel-11').val() + "&";
	postVars+="ability-ion=" + $('#defenderAbilityLevel-SkillIonDamage').val() + "&";
	postVars+="science-12=" + $('#defenderScienceLevel-12').val() + "&";
	postVars+="ability-plasma=" + $('#defenderAbilityLevel-SkillPlasmaDamage').val() + "&";
	postVars+="science-18=" + $('#defenderScienceLevel-18').val() + "&";
	postVars+="ability-damage=" + $('#defenderAbilityLevel-SkillAllDamage').val() + "&";
	postVars+="ability-attack=" + $('#defenderAbilityLevel-StatShipsAttack').val() + "&";
	postVars+="science-21=" + $('#defenderScienceLevel-21').val() + "&";
	postVars+="science-22=" + $('#defenderScienceLevel-22').val() + "&";
	postVars+="science-23=" + $('#defenderScienceLevel-23').val() + "&";
	postVars+="ability-armor=" + $('#defenderAbilityLevel-SkillShipsArmor').val() + "&";
	postVars+="ability-shipslife=" + $('#defenderAbilityLevel-SkillShipsLife').val() + "&";
	postVars+="ability-defencelife=" + $('#defenderAbilityLevel-SkillDefenceLife').val() + "&";
	postVars+="science-7=" + $('#defenderScienceLevel-7').val() + "&";
	postVars+="ability-shipsdefencelife=" + $('#defenderAbilityLevel-SkillShipsDefenceLife').val() + "&";
	postVars+="science-19=" + $('#defenderScienceLevel-19').val() + "&";
	postVars+="ability-statshipslife=" + $('#defenderAbilityLevel-StatShipsLife').val() + "&";
	postVars+="science-20=" + $('#defenderScienceLevel-20').val() + "&";
	postVars+="ability-critical=" + $('#defenderAbilityLevel-SkillCriticalChance').val() + "&";
	postVars+="equip-attack=" + $('#defenderAdmiralEquipmentValue-attack').val() + "&";
	postVars+="equip-life=" + $('#defenderAdmiralEquipmentValue-life').val();
	
	$.post("ajax_fleets.php", postVars, function(response){	
		var data = eval('(' + response + ')');
		if (data.pass == '1') {
			$('#defendername').append('<option value="' + Math.floor(Math.random() * (1000000 - 1)) + '">' + data.name + '</option>');
		}		
			showDialogMessage(data.info);
			//localStorage.clear();
			try {
			  localStorage.removeItem('expiretime');
			  localStorage.removeItem('positions');
			}
			catch(err) {}
	});
}

function simulatorDefenderScience() {
	var postVars ="type=Defendersciences&";
	postVars+="name=" + $('#defendername option:selected').text();
	$.post("ajax_fleets.php", postVars, function(response){
		var data = eval('(' + response + ')');
		
		// Fill defender sciences
		for(defender_science_id in data.defenderSciences) {
			$('#defenderScienceLevel-' + defender_science_id).val(data.defenderSciences[defender_science_id].level);
		}
		// Fill defnder abilities
		for(abiliti_id in data.defenderAbilities) {
			$('#defenderAbilityLevel-' + abiliti_id).val(data.defenderAbilities[abiliti_id].level);
		}
		// Fill equipment
		for (bonus_type in data.defenderEquipmentBonuses) {
			$('#defenderAdmiralEquipmentValue-' + bonus_type).val(data.defenderEquipmentBonuses[bonus_type]);
		}
		showDialogMessage("Loaded Defender Sciences");
		//localStorage.clear();
		try {
		  localStorage.removeItem('expiretime');
		  localStorage.removeItem('positions');
		}
		catch(err) {}
	});
}

function simulatorLoadData() {
    $.post("ajax_fleets.php",{
	    type:'getSimulatorData'
		}, function(response){
			var data = eval('(' + response + ')');
			
				// Fill the ships
					for(ship_id in data.playerShips) {
						    $('#attackerShipCount-' + ship_id).val(data.playerShips[ship_id].count);
								$('#attackerShipLevel-' + ship_id).val(data.playerShips[ship_id].level);
									}
										
											// Fill commander ships
												for(ship_id in data.playerCommanderShips) {
													    $('#attackerCommanderShipName-' + ship_id).html(data.playerCommanderShips[ship_id].name);
															$('#defenderCommanderShipName-' + ship_id).html(data.playerCommanderShips[ship_id].name);
																    
																		$('#attackerCommanderShipPop-' + ship_id).val(data.playerCommanderShips[ship_id].pop);
																			    $('#defenderCommanderShipPop-' + ship_id).val(data.playerCommanderShips[ship_id].pop);
																					
																						    $('#attackerCommanderShipCount-' + ship_id).val(data.playerCommanderShips[ship_id].available);
																								$('#attackerCommanderShipLevel-' + ship_id).val(data.playerCommanderShips[ship_id].level);
																									    
																											selected = '';
																												    if (data.playerCommanderShips[ship_id].is_lead == 1) {
																														    selected='selected="selected"';
																																}
																																	    if($("#attackerLeadCommander option[value='"+ship_id+"']").length != 1) {
																																			    $('#attackerLeadCommander').append('<option value="' + ship_id + '"' + selected +  '>' + data.playerCommanderShips[ship_id].name + '</option>');
																																					}
																																						    if($("#defenderLeadCommander option[value='"+ship_id+"']").length != 1) {
																																								    $('#defenderLeadCommander').append('<option value="' + ship_id + '">' + data.playerCommanderShips[ship_id].name + '</option>');
																																										}
																																											}
																																											
																																												// Fill the sciences
																																													for(science_id in data.playerSciences) {
																																														    $('#attackerScienceLevel-' + science_id).val(data.playerSciences[science_id].level);
																																															    }
																																																    
																																																	    // Fill abilities
																																																		    for(abiliti_id in data.playerAbilities) {
																																																				$('#attackerAbilityName-' + abiliti_id).html(data.playerAbilities[abiliti_id].name);
																																																					    $('#defenderAbilityName-' + abiliti_id).html(data.playerAbilities[abiliti_id].name);
																																																							
																																																								    $('#attackerAbilityLevel-' + abiliti_id).val(data.playerAbilities[abiliti_id].level);
																																																									    }
																																																									    
																																																										    // Fill equipment
																																																											    for (bonus_type in data.playerEquipmentBonuses) {
																																																													$('#attackerAdmiralEquipmentValue-' + bonus_type).val(data.playerEquipmentBonuses[bonus_type]);
																																																														}
																																																															
																																																																// Fill Load Simulat Name
																																																																	for (id in data.defenderScienceName) {
																																																																		    var optionExists = $("#defendername option[value='"+id+"']").length;
																																																																				if(optionExists != 1)
																																																																					    {
																																																																							    $('#defendername').append('<option value="' + id + '">' + data.defenderScienceName[id].name + '</option>');
																																																																									}
																																																																										}
																																																																										
																																																																											simulatorChangeNames();
																																																																												//localStorage.clear();
																																																																													try {
																																																																														  localStorage.removeItem('expiretime');
																																																																															  localStorage.removeItem('positions');
																																																																																}
																																																																																	catch(err) {}
																																																																																	    });
																																																																																	    }
function simulatorChangeNames() {
	var at_race = $('#choose_race1').val();
	var de_race = $('#choose_race2').val();

	for(var i=1; i<14; i++) {
		$('#attackerShipName-' + i).html(raceShips[at_race][i]['name']);
		$('#defenderShipName-' + i).html(raceShips[de_race][i]['name']);
		$('#attackerShipPicture-' + i).css('background', 'url(' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/simulator/ships/race' + at_race + '/ship_' + i + '.jpg)');
		$('#defenderShipPicture-' + i).css('background', 'url(' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/simulator/ships/race' + de_race + '/ship_' + i + '.jpg)');
		$('#attackerShipPop-' + i).val(raceShips[at_race][i]['pop']);
		$('#defenderShipPop-' + i).val(raceShips[de_race][i]['pop']);
		if(i < 11 && i != 3) {
			$('#defenderDefencePicture-' + i).css('background', 'url(' + GLOBAL_HTTP_PATH_IMAGES + 'img/v2.0/img/simulator/defence/race' + de_race + '/defence_' + i + '.jpg)');
			$('#defenderDefenceName-' + i).html(raceDefence[de_race][i]['name']);
			$('#defenderDefencePop-' + i).val(raceDefence[de_race][i]['pop']);
		}
	}
	
	simulatorUpdatePopDisplays();
}

function simulatorClear(form) {
	$('input, select', form).each(function() {
		if (this.type == 'text') {
			this.value = '0';
		} else if (this.type == 'checkbox' || this.type == 'radio'){
			this.checked = false;
		} else if (this.name.indexOf('CommanderShipCount') > -1) {
			this.selectedIndex = 0;
		}
	});
	
	simulatorUpdatePopDisplays();
};

function simulatorGetPop(playerType, unitType) {
	var totalPop = 0;
	var unitTypes = {
		'ships': ['Ship', 'CommanderShip'],
		'defence': ['Defence']
	}
	
	if (playerType != 'attacker' && playerType != 'defender') {
		return totalPop;
	}
	
	if (unitType != 'ships' && unitType != 'defence') {
		return totalPop;
	}
	
	for (i in unitTypes[unitType]) {
		$('input[id^="' + playerType + unitTypes[unitType][i] + 'Pop-"]').each(function(){
			var popElem = $(this);
			var unitId = popElem.attr('id').match(/-(\d+)$/)[1];
			
			var countElem = $('#' + playerType + unitTypes[unitType][i] + 'Count-' + unitId);
			
			var popNum = parseInt(popElem.val());
			var countNum = parseInt(countElem.val());
			
			if (isNaN(popNum)) {
				popNum = 0;
			}
			
			if (isNaN(countNum)) {
				countNum = 0;
			}
			
			if (unitType == 'defence' && (unitId == 6 || unitId == 7)) {
				if (countElem.attr('checked') == 'checked') {
					countNum = 1;
				} else {
					countNum = 0;
				}
			}
			
			totalPop += popNum  * countNum;
		});
	}
	
	return totalPop;
}

function simulatorAddChangeListeners() {
	var playerTypes = ['attacker', 'defender'];
	var unitTypes = ['Ship', 'CommanderShip', 'Defence'];
	
	for (pt in playerTypes) {
		for (unitId in unitTypes) {
			$('input[id^="' + playerTypes[pt] + unitTypes[unitId] + 'Count-"]').each(function(){		
				$(this).keyup(function(){
					simulatorUpdatePopDisplays();
				});
			});
			
			$('input[id^="' + playerTypes[pt] + unitTypes[unitId] + 'Count-"][type="checkbox"]').each(function(){
				$(this).change(function(){
					simulatorUpdatePopDisplays();
				});
			});
			
			$('select[id^="' + playerTypes[pt] + unitTypes[unitId] + 'Count-"]').each(function(){
				$(this).change(function(){
					simulatorUpdatePopDisplays();
				});
			});
		}
	}
}

function simulatorUpdatePopDisplays() {
	$('#attackerShipPopDisplay').html(number_format(simulatorGetPop('attacker', 'ships')));
	$('#defenderShipPopDisplay').html(number_format(simulatorGetPop('defender', 'ships')));
	$('#defenderDefencePopDisplay').html(number_format(simulatorGetPop('defender', 'defence')));
}

function simulatorSimulate() {
	simulatorUpdatePopDisplays();
	
	if (simulatorGetPop('attacker', 'ships') > battlesimulatorPopShips
		|| simulatorGetPop('defender', 'ships') > battlesimulatorPopShips
		|| simulatorGetPop('defender', 'defence') > battlesimulatorPopDefence
		) {
		showDialogMessage(battlesimulatorOverPopMsg);
		return false;
	}
	
	$('#simulatorForm').submit();
	return true;
}

function selectMissionImg(missionId) {
	$('#mission option[value=' + missionId + ']').prop('selected', true);

	// Clear the old selection
	$('[id^="selectMissionImg-"]').removeClass('active');

	// Select the new image
	$('#selectMissionImg-' + missionId).addClass('active');
}

function selectMissionByIndex() {
	selectMissionImg($('#mission').val());
}

function fleetsTableToggle() {
	$( "#fleetTable" ).toggle('slide', {direction: 'up'}, 'slow', function(){
		$('#fleetsTitle').toggleClass('titleBottom');
	});
}

function fleetsTableShow() {
	$('#fleetTable').slideDown(function(){
		$('#fleetsTitle').removeClass('titleBottom');
	});
}

function fleetsTableHide() {
	$('#fleetTable').slideUp(function(){
		$('#fleetsTitle').addClass('titleBottom');
	});
}

function missionDetailsShow(tooltip, description) {
	Tip(tooltip);
	$('#shipsMissionDescription').html(description);
}

function missionDetailsHide() {
	UnTip();
	$('#shipsMissionDescription').html('');
}

CountDown();
