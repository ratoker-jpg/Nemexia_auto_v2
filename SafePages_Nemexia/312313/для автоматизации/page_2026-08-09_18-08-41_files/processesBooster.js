function ProcessesBoosterManager() {
	var _this = this;

	this.showApplyConfirm = function(processType, processId, onResponseCallback) {
		$.post('ajax_process_booster.php?uid=' + (new Date()).valueOf(), {
			type: 'getApplyConfirmation',
			processType: processType,
			processId: processId
		}, function(response) {
			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			showConfirm(response.message, function() {
				_this.apply(processType, processId, onResponseCallback);
			});
		}, 'json');
	};

	this.apply = function(processType, processId, onResponseCallback) {
		$.post('ajax_process_booster.php?uid=' + (new Date()).valueOf(), {
			type: 'apply',
			processType: processType,
			processId: processId
		}, function(response) {
			refreshSession('session');
			executeCallback(onResponseCallback);

			if (response.status === false) {
				showDialogMessagePopup(response.message);
				return;
			}

			showDialogMessage(response.message);
		}, 'json');
	};
}