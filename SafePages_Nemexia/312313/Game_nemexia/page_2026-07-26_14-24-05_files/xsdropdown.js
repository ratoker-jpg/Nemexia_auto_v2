/**
 * xsdropdown jQuery plugin.
 * Adds dropdown-control-like functionality to elements 
 */
(function($) {
	
	var allItems = [];
	
	var methods = {
		init: function(tooltips) {			
			return this.each(function() {
				var $this = $(this);
				allItems.push($this);
				var value;
				var disabled = $this.attr('data-xsdropdown-disabled') == 'true';
				var selected = $this.find('[data-xsdropdown-selected="true"]');
				if (selected.length == 0) {
					value = $this
							.find('[data-xsdropdown-value]')
							.first()
							.addClass('selected')
							.attr('data-xsdropdown-value');
				} else {
					value = $(selected).attr('data-xsdropdown-value');
				}
				$this.data('data', {xsdropdown: true, disabled: disabled, value: value, active: false});
				
				var arrow = $this.find('[data-xsdropdown-arrow]');
				var icon = arrow.find('.icon');
				icon.addClass(value);
				arrow.bind('click.xsdropdown', function() {
					if (!$this.data('data').disabled) {
						if ($this.hasClass('active')) {
							$this.removeClass('active');
						} else {
							for (var i = 0; i < allItems.length; i++) {
								if (allItems[i] != $this) {
									allItems[i].removeClass('active');
								}
							}
							$this.addClass('active');
						}
					}
				});
				$this.bind('mouseenter.xsdropdown', function() {
					Tip(tooltips[$this.data('data').value]);
				});
				$this.bind('mouseleave.xsdropdown', UnTip);
				
				$this.find('[data-xsdropdown-value]').each(function() {
					var value = $(this).attr('data-xsdropdown-value');
					$(this).addClass(value);
					$(this).bind('click.xsdropdown', function() {
						if ($this.data('data').disabled) {
							return;
						}
						var data = $this.data('data');
						icon.removeClass(data.value);
						icon.addClass(value);
						$this.find('[data-xsdropdown-disabled-view]').removeClass(data.value).addClass(value);
						data.value = value;
						$this.data('data', data);
						$this.find('[data-xsdropdown-value].selected').removeClass('selected');
						$(this).addClass('selected');
						$this.removeClass('active');
					});
					$(this).bind('mouseenter.xsdropdown', function() {
						Tip(tooltips[value]);
					});
					$(this).bind('mouseleave.xsdropdown', UnTip);
				});
			});
		},
		
		val: function() {
			data = $(this).data('data');
			if (!data.xsdropdown) {
				throw 'xsdropdown not initialized on object';
			}
			return data.value;
		},
		
		disabled: function(value) {
			data = $(this).data('data');
			if (!data.xsdropdown) {
				throw 'xsdropdown not initialized on object';
			}
			if (value == undefined) {
				return data.disabled;
			}
			data.disabled = value == true;
			this.data('data', data);
			if (data.disabled) {
				this.removeClass('dropdown');
				this.addClass('nodropdown');
			} else {
				this.removeClass('nodropdown');
				this.addClass('dropdown');
			}
			return this;
		}
	};
	
	$.fn.xsdropdown = function(method) {
		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else if (!method) {
			return methods.init.apply(this);
		} else {
			$.error('Method ' + method + ' does not exist on jQuery.xsdropdown');
		}
	};
	
})(jQuery);