var typeHandler = new Array();
var lastTab = new Array();

function loadTabContent(tabId, msg_type, page) {
    if( undefined === page ) page = 0;
    
    lastTab = [ tabId, msg_type ];
    if(isset(typeHandler[tabId]) && isset(typeHandler[tabId][page])) {
            $('#'+tabId+'Box').html(typeHandler[tabId][page]);
    } else {
        $.post('ajax_messages.php', {
            option: 'viewMessages',
            type: msg_type,
            tabId: tabId,
            page: page
        }, function(response){
            $('#'+tabId+'Box').html( response );
            var newMsg = $('#new' + msg_type).html() * 1;
            if(newMsg > 0 && msg_type > 0) {
            	var globalNewMsg = $('#newMessages').html() * 1;
            	
            	tmp = globalNewMsg - newMsg;
            	
            	if(tmp <= 0) {
            		$('#newMessages').hide();
            	} else {
            		$('#newMessages').html("" + tmp);
            	}
            	$('#new' + msg_type).html("0");
            }
            
            if(!isset(typeHandler[tabId])) {
            	typeHandler[tabId] = new Array();
            }
            typeHandler[tabId][page] = response;
        });
    }
}

function loadWall(page){
    var msg_type = 6;
    
    $.post('ajax_messages.php', {
        option: 'wallMessages',
        page: page
    }, function(response){
        $('#TabWallBox').html( response );
        var newMsg = $('#new' + msg_type).html() * 1;
        if(newMsg > 0 && msg_type > 0) {
            var globalNewMsg = $('#newMessages').html() * 1;

            tmp = globalNewMsg - newMsg;

            if(tmp <= 0) {
                    $('#newMessages').hide();
            } else {
                    $('#newMessages').html("" + tmp);
            }
            $('#new' + msg_type).html("0");
        }

        if(!isset(typeHandler['TabWall'])) {
            typeHandler['TabWall'] = new Array();
        }
        typeHandler['TabWall'][page] = response;
    });
}                

function messageButtons(msgId,func,tabId,msg_type,page) {
    $.post('ajax_messages.php',{
            option: func,
            type: msgId
    }, function(response){
            if(func == 'deleteMessage') {
                typeHandler[tabId] = new Array();
                loadTabContent(tabId,msg_type,page);
            }
            
			if (func == 'historyMessage') {
				showDialogMessagePopup(response);
			} else {
				showDialogMessage(response);
			}
    });
}

function sendPersonalMessage() {
    $.post('ajax_messages.php', {
        option: 'writeMessage',
        type: $('#sendUser').val(),
        message: $('#sendMessage').val()
    }, function(response) {
        showDialogMessage(response);

		var tabId = isset(lastTab[0]) ? lastTab[0] : 'TabPersonal';
		var msg_type = isset(lastTab[1]) ? lastTab[1] : 1;
		loadTabContent( tabId, msg_type, 0 );
		showTab( tabId );
    });
}

function addToList(list, playerId, username) {
	$.post('ajax_messages.php', {
            option: 'addTo' + list,
            type: playerId,
            tabId: username
    }, function(response){
    	if(list == 'Buddy') {loadFriendList(1);} 
    	else {loadFriendList(2);}
    	
    	showTab('Tab' + list + 'List');
        showDialogMessage(response);
    });
}

function deleteAllMessages(type) {
	
	showConfirm(DELETE_ALL_CONFIRM, function(){
	
		$.post('ajax_messages.php', {
	            option: 'deleteAllMessages',
	            type: type
	    }, function(response){
	    	showDialogMessage(response);
	    	typeHandler = Array();
	    	
	    	var tabId = isset(lastTab[0]) ? lastTab[0] : 'TabPersonal';
            var msg_type = isset(lastTab[1]) ? lastTab[1] : 1;
            $('#new' + msg_type).html("0");
	    	$('#old' + msg_type).html("0");
            loadTabContent( tabId, msg_type, 0 );
            showTab( tabId );
	    });
	});
}


function deleteSelectedMessages(type) {
	showConfirm(DELETE_SELECTED_CONFIRM, function() {
		
		var data = '';
		$("input[name^='messageSelect']:checked").each(function(i) {
			if ($(this).val()) {
				data += $(this).val() + ',';
			}
		});
		
		$.post('ajax_messages.php', {
	            option: 'deleteSelectedMessages',
	            type: type,
	            messages: data
	    }, function(response){
	    	showDialogMessage(response);
	    	typeHandler = Array();
	    	
	    	var tabId = isset(lastTab[0]) ? lastTab[0] : 'TabPersonal';
            var msg_type = isset(lastTab[1]) ? lastTab[1] : 1;

            loadTabContent( tabId, msg_type, 0 );
            showTab( tabId );
	    });
	});
}