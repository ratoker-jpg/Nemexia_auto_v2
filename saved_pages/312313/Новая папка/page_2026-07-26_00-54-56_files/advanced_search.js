var ajaxSearchUrl = 'ajax_advanced_search.php';

function searchByPoints(page) {
    if( undefined === page ) page = '';
    var params = $('#pointsSearchForm').serialize() 
        + '&page='+page
        + '&type=points'
		+ '&pointsType=' + $('#points_type').val();
    $.post(ajaxSearchUrl+'?uid='+(new Date()).valueOf(), params, function(response) {
          if( response.length > 0 ) {
              $('#pointsResults').html(response);
              $('#pointsResultsBox').show();
          }
      });
    return false;
}


function searchByName(page) {
    if( undefined === page ) page = '';
    var params = $('#nameSearchForm').serialize() 
        + '&page='+page
        + '&type=name';
    $.post(ajaxSearchUrl+'?uid='+(new Date()).valueOf(), params, function(response) {
          if( response.length > 0 ) {
              $('#nameResults').html(response);
              $('#nameResultsBox').show();
          }
      });
    return false;
}

function setPredefinedPoints(data) {
	$('#txt_points_down').val(data[$('#points_type').val()].min);
	$('#txt_points_up').val(data[$('#points_type').val()].max);
}

function init(){
    $('#txt_points_down, #txt_points_up, #txt_c1_down, #txt_c2_down, #txt_c3_down, #txt_c1_up, #txt_c3_up, #txt_c3_up')
    .bind('keyup, blur', function(){
        filterIntDigits(this);
    })
}

$(document).ready(function(){
    init();
})
