function loanResource(){
    $.post('ajax_bank.php', $('#borrowResourcesForm').serialize() + '&type=borrowResources', function(response){
        var info = eval('('+ response + ')');
		
		refreshSession('session');
		
        if(info.success > 0) {
			$('#borrowFormHolder .box').slideUp('normal', function() {
				$('#borrowFormHolder h1').addClass('titleBottom');
			});
			$('#borrowResourcesTab .message.information').hide();
			$('#borrowResourcesTab .message.error').show();
            loadBorrowHistory(0);
        }
		
        if( isset(info.msg) ) {
        	showDialogMessage(info.msg);
        }
    });

    return false;
}

function loadBorrowHistory(page){
    $.post('ajax_bank.php', {
		type: 'borrowHistory', 
		page: (typeof(page)!='undefined' ? page : '')
	}, function(response){
		$('#borrow_history').html(response);
		$('#borrow_history').slideDown('normal');
	});

    return false;
}

function clearBorrowHistory() {
	$.post('ajax_bank.php', {type: 'clearBorrowHistory'}, 
			function(response){
				var info = eval('('+ response + ')');
				if(info.success > 0) {
					loadBorrowHistory(0);
				}
				if( isset(info.msg) ) {
					showDialogMessage(info.msg);
				}
			});
}

function restoreResources(id){
    $.post('ajax_bank.php', {
        type: 'restoreResources',
        id: id
    }, function(response){
		var info = eval('('+ response + ')');
		
		refreshSession('session');
		
		if(info.success > 0) {
			$('#borrowFormHolder .box').slideDown('normal', function() {
				$('#borrowFormHolder h1').removeClass('titleBottom');
			});
			$('#borrowResourcesTab .message.information').show();
			$('#borrowResourcesTab .message.error').hide();
			loadBorrowHistory(0);
		}
		
		if( isset(info.msg) ) {
			showDialogMessage(info.msg);
		}
	});
	
	return false;
}

function deleteHistory(id){
    $.post('ajax_bank.php', {
        type: 'deleteHistory',
        id: id
    }, function(response){
        var info = eval('('+ response + ')');
        if(info.success > 0) {
            loadBorrowHistory(0);
        }
        if( isset(info.msg) ) {
        	showDialogMessage(info.msg);
        }
    });

    return false;
}

function spreadResources(){
    var total = $('#txt_total_loan_resource_value').get(0);

    $('#txt_loan_metal, #txt_loan_crystal, #txt_loan_gas').each(function(){
        if( total.value == "" || isNaN(total.value) || parseInt(total.value) == 0) {
            this.value = 0;
        } else {
            this.value = Math.floor( parseInt(total.value) / 3 ); // 3 - means 3 res type (metal,crystal,gas)
        }
    });
}

function setMaxResources(){
    var max_resources = Math.floor( parseInt(max_total_resource / BANK_LOAN_RESOURCE_PER_CREDIT) ) ;
    var max_credits = PLAYER['credits'];
    
    if( max_resources > max_credits ) {
        max_resources = max_credits ;
    }
    
    $('#txt_credits').val( max_resources ).keyup();
}

function showHistory() {
	loadBorrowHistory();
	$('#a_showHistory').hide();
	$('#a_hideHistory').show();
};

function hideHistory() {
	$('#borrow_history').slideUp();
	$('#a_hideHistory').hide();
	$('#a_showHistory').show();
};


$(document).ready(function() {
    
    // Allow only integers in these text fields
    $('#txt_credits, #txt_loan_metal, #txt_loan_crystal, #txt_loan_gas').bind('keyup', function(){
        filterIntDigits(this);
    });
    
    // Calculate Total Resources for credits value
    $('#txt_credits').bind('keyup',function(){
          if( this.value == "" || isNaN(this.value) || this.value == '0') {
              $('#txt_total_loan_resource_value').val('0');
              return false;
          }
          var resource_value = parseInt(this.value) * BANK_LOAN_RESOURCE_PER_CREDIT;
          $('#txt_total_loan_resource_value').val( resource_value );
          return false;
    });
    
    $('#txt_credits').bind('blur', function(){
        if( parseInt(this.value) * BANK_LOAN_RESOURCE_PER_CREDIT > max_total_resource || parseInt(this.value) > PLAYER['credits']) {
            setMaxResources();
        }
    });
    
    $('#txt_loan_metal, #txt_loan_crystal, #txt_loan_gas').bind('blur', function(){     
		var resSum = parseInt($('#txt_loan_metal').val()) + parseInt($('#txt_loan_crystal').val()) + parseInt($('#txt_loan_gas').val());
		$('#txt_credits').val( parseInt(resSum / BANK_LOAN_RESOURCE_PER_CREDIT) ).keyup();
	});
      
});