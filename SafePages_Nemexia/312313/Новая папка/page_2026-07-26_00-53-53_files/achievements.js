/*
 * Js functions for Achievements
 */

function loadAchievementsByCategory(category_id) {
	// Check for already loaded category (Request count optimization only)
	currentActiveTabId = $('#TabAchievementsCategories .buttonrow a.active').attr('id');
	if (currentActiveTabId !== undefined && currentActiveTabId.split('_')[1] == category_id) {
		return;
	}
	
	$.post('ajax_info.php', {
		type: 'loadAchievementsByCategory',
		category_id: category_id
	}, function(response){
		$('#TabAchievementsList').html(response);

		$('#TabAchievementsCategories .buttonrow a').each(function(index) {
			$(this).removeClass('active');
		});
		$('#cat_'+category_id).addClass('active');
	});
}