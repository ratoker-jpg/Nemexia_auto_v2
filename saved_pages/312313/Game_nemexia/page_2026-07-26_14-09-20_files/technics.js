var typeHandler = new Array("","","","","", "");

function loadBuildings() {
	if(typeHandler[1] == "")
		$.post("ajax_technics.php",{
			option:'Buildings'
		}, function(response){
		    typeHandler[1] = response;
		    $('#TabBuildings').html(typeHandler[1]);
		});
	else {
		$('#TabBuildings').html(typeHandler[1]);
	}
		
	$('#previewScience').hide();
	$('#previewBuildings').show();
	$('#previewShips').hide();
	$('#previewDefence').hide();
	$('#previewCommanderShips').hide();
}

function loadShips() {
	if(typeHandler[2] == "")
		$.post("ajax_technics.php",{
			option:'Ships'
		}, function(response){
		    typeHandler[2] = response;
		    $('#TabShips').html(typeHandler[2]);
		});
	else {
		$('#TabShips').html(typeHandler[2]);
	}
		
	$('#previewScience').hide();
	$('#previewBuildings').hide();
	$('#previewShips').show();
	$('#previewDefence').hide();
	$('#previewCommanderShips').hide();
}

function loadResearches() {
	if(typeHandler[3] == "")
		$.post("ajax_technics.php",{
			option:'Researches'
		}, function(response){
		    typeHandler[3] = response;
		    $('#TabResearches').html(typeHandler[3]);
		});
	else {
		$('#TabResearches').html(typeHandler[3]);
	}
	
	$('#previewScience').show();
	$('#previewBuildings').hide();
	$('#previewShips').hide();
	$('#previewDefence').hide();
	$('#previewCommanderShips').hide();
}

function loadDefence() {
	if(typeHandler[4] == "")
		$.post("ajax_technics.php",{
			option:'Defence'
		}, function(response){
		    typeHandler[4] = response;
		    $('#TabDefence').html(typeHandler[4]);
		});
	else {
		$('#TabDefence').html(typeHandler[4]);
	}
		
	$('#previewScience').hide();
	$('#previewBuildings').hide();
	$('#previewShips').hide();
	$('#previewDefence').show();
	$('#previewCommanderShips').hide();
}

function loadCommanderShips() {
	if(typeHandler[5] == "")
		$.post("ajax_technics.php",{
			option:'CommanderShips'
		}, function(response){
		    typeHandler[5] = response;
		    $('#TabCommanderShips').html(typeHandler[5]);
		});
	else {
		$('#TabCommanderShip').html(typeHandler[5]);
	}
		
	$('#previewScience').hide();
	$('#previewBuildings').hide();
	$('#previewShips').hide();
	$('#previewDefence').hide();
	$('#previewCommanderShips').show();
}