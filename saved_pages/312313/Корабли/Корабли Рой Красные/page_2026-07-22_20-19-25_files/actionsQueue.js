function getActionsQueuePopup() {
	if (window.actionsQueuePopup == undefined) {
		window.actionsQueuePopup = new ActionsQueuePopup();
	}

	return window.actionsQueuePopup;
}

function ActionsQueuePopup() {
	var _this = this;
	var _url = 'ajax_misc.php';

	this.show = function() {
		$.post(_url, {
			type: 'loadActionsQueueWindow'
		}, function(response){
			floatingEnable = 0;
			$("#dialogMessage").addClass('ActionsQueuePopup');

			$("#dialogBox").html(response);

			$('#dialogMessage').fadeIn('fast');
			$('.black_overlay').show();

			_this.addEventListeners();
		});
	}

	this.hide = function(callback) {
		$('#dialogMessage').fadeOut('slow', function() {
			$('.black_overlay').hide();
			$("#dialogMessage").removeClass('ActionsQueuePopup');
			floatingEnable = 1;

			if (undefined !== callback) {
				if(typeof(callback) == 'string') {
					eval(callback);
				} else if (typeof(callback) == 'function') {
					callback.call();
				}
			}

			_this.removeEventListeners();
		});
	}

	this.addEventListeners = function() {
		$('#actionsQueue_closeButton, .black_overlay').bind('click', function(){
			_this.hide(function(){
				_this.notifyPopupQueues();
			});
		});
	}

	this.removeEventListeners = function() {
		$('#actionsQueue_closeButton, .black_overlay').unbind('click');
	}

	this.notifyPopupQueues = function() {
		if(typeof LoginPopupsQueue == 'object') {
			LoginPopupsQueue.exec();
		}
	}

}