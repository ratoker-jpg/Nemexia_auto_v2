function showPromoMessage() {
	floatingEnable = 0;
	$("#dialogMessage").addClass('promoBox');

	$("#dialogBox").html($('#promo_popup').html());
	
    $('#dialogMessage').fadeIn('fast');
    $('.black_overlay').show();
	$('.black_overlay').bind('click', closePromoMessage);
}

function closePromoMessage(callback) {
	$('#dialogMessage').fadeOut('slow', function() {
        $('.black_overlay').hide();
		$('.black_overlay').unbind('click');
        $("#dialogMessage").removeClass('promoBox');
		floatingEnable = 1;
        
        
        if( undefined !== callback ){
			if(typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
        
    });
}

function loadPromoWindow(callback) {
	$.post('ajax_misc.php' + '?uid=' +(new Date()).valueOf(), {type: 'loadPromoWindow'}, function(response) {
		if (response == "") {
			// Hide buttons and labels about promotions
			$('a.happyHourLabel').hide();
			$('a.promoLabel').hide();
			$('#vipMenuCurrentPromoBtn').hide();
			
			return false;
		}
		
		$('#promo_popup').html(response);

		if(undefined !== callback) {
			if (typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
	});
}