
function loadModule(type,planet_id) {
	
	if($('#PlanetHolder-' + planet_id).css('display') == 'none') {
		loadPlanetContent(planet_id);
		$('#PlanetHolder-' + planet_id).toggle('normal');
	}
	
	if($('#' + type + 'Holder-' + planet_id).html() == "") {
		$.post("ajax_overview.php",{
			type: type,
			planetId: planet_id
		}, function(xhtml) {
			$('#' + type + 'Holder-' + planet_id).html(xhtml);
			hideAllHolders(type,planet_id);
		});
	} else {
		if($('#' + type + 'Holder-' + planet_id).css('display') == 'none') {
			hideAllHolders(type,planet_id);
		}
	}
}

function loadPlanetContent(planet_id) {
	if($('#PlanetContentHolder-' + planet_id).html() == "") {
		$.post("ajax_overview.php",{
			type: 'Planet',
			planetId: planet_id
		}, function(xhtml) {
			$('#PlanetContentHolder-' + planet_id).html(xhtml);
			loadModule('Buildings', planet_id);
		});
	}
}


function hideAllHolders(type,planet_id) {
	
	$('#BuildingsHolder-' + planet_id).hide();
	$('#ShipsHolder-' + planet_id).hide();
	$('#DefenceHolder-' + planet_id).hide();
	$('#ScienceHolder-' + planet_id).hide();
	$('#' + type + 'Holder-' + planet_id).show();
	
	$('#BuildingsLi-' + planet_id).attr('class','');
	$('#ShipsLi-' + planet_id).attr('class','');
	$('#DefenceLi-' + planet_id).attr('class','');
	$('#ScienceLi-' + planet_id).attr('class','');
	
	$('#' + type + 'Li-' + planet_id).attr('class','active');
}