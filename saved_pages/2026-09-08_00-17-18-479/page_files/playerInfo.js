function loadAchievements(player_id) {
	if($('#achievementsContainer').html() != "") {
		$('#achievementsContainer').html(response);
		showPannel('contentWrapper', 'achievementsContainer', undefined, 'playerInfoContainer');
		return;
	}
	$.post('ajax_info.php', {
		type: 'loadAchievements',
		hideIncomplete: 1, 
		player_id: player_id
	}, function(response){
		$('#achievementsContainer').html(response);
		showPannel('contentWrapper', 'achievementsContainer', undefined, 'playerInfoContainer');
	});
}

function loadPlayerInfoPannel(panel) {

	var panelConfig = PlayerInfoPannelsConfigMap[panel];

	if ($('#' + panelConfig.pannelId).html() == "") {
		if (!panelConfig.params) {
			panelConfig.params = {};
		}
		panelConfig.params.type = panelConfig.ajaxMethod;
		$.post('ajax_info.php', 
				panelConfig.params,
				function(response){
					$('#' + panelConfig.pannelId).html(response);
					showPannel('contentWrapper', panelConfig.pannelId, undefined, 'playerInfoContainer');
				}
		);
	} else {
		showPannel('contentWrapper', panelConfig.pannelId, undefined, 'playerInfoContainer');
	}
}
