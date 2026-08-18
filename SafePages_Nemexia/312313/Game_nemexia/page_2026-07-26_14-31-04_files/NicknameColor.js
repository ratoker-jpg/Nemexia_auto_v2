function NicknameColor(premiumPopup) {
	var _subDisplayContainer = $('.premiumSubDisplay.nicknameColor');
	var color = _subDisplayContainer.find('#nicknameColor_colorpickerHolder').attr('data-colorPicker-selectedColor');

	if (!color || color === undefined) {
		color = '#00ff00';
	} else if(!(new String(color)).match(/^#/gm)){
		color = '#' + color;
	}

	color = color.toLowerCase();

	function _initColorPicker() {
		if (!$('body').ColorPicker) {
			setTimeout(_initColorPicker, 10);
			return;
		}
		_subDisplayContainer.find('#nicknameColor_colorpickerHolder').ColorPicker({
			flat: true,
			color: color,
			onSubmit: function(hsb, hex, rgb) {
				_subDisplayContainer.find('#nicknameColor_namePreview').css('color', '#' + hex);
				_subDisplayContainer.find('#nicknameColor_colorpickerHolder').attr('data-colorPicker-selectedColor', hex);
			},
			onChange: function (hsb, hex, rgb) {
				_subDisplayContainer.find('#nicknameColor_namePreview').css('color', '#' + hex);
				_subDisplayContainer.find('#nicknameColor_colorpickerHolder').attr('data-colorPicker-selectedColor', hex);
			}
		});	
	}
	
	_initColorPicker();

	_subDisplayContainer.find('#nicknameColor_submit').click(function(){
		showConfirm(premiumPopup.getTranslation('COLOR_CHANGE_CONFIRM'), function () {
			premiumPopup.applyMethod('subtabColorizeName', 'changeColor', {
				color: _subDisplayContainer.find('#nicknameColor_colorpickerHolder').attr('data-colorPicker-selectedColor')
			});
		});
	});

}

if (window.dependencyResolver) {
	window.dependencyResolver.markAsLoaded('NicknameColor');
}
