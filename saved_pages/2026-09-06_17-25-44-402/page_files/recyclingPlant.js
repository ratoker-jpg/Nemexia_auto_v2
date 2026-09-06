 $(function() {	
	// I would like to appologise to the future developper handling the sliders code
	// I had to add "Max. value functionality". It was a lot of patching,
	// but I had at least two others before me, that had made the job quite tricky.
	var resourceSlides = [$('#slide2'), $('#slide3'), $('#slide4')];
	$('#slide2').data('sliderIdx', 0),
	$('#slide3').data('sliderIdx', 1),
	$('#slide4').data('sliderIdx', 2);
	
	function getMaxValueForSlider(idx) {
		var total = 0;
		for (var  i = 0; i < resourceSlides.length; i++) {
			if (idx == undefined || i != idx) {
				total += parseInt(resourceSlides[i].slider('value'));
			}
		}
		return 100 - total;
	}
	
	var eh = function(event, ui) {
    	var value = ui.value;
    	var allowSlide = true;
    	var maxValue = getMaxValueForSlider($(this).data('sliderIdx'));
    	if (maxValue < value) {
    		value = maxValue;
    		allowSlide = false;
    		 $(ui.handle).parent().slider('value', value);
    		
    	}
    	var Handelid = ui.handle.id;
		var id = Handelid.replace('Handel', "value");
		document.getElementById(id).innerHTML = value;
    	
    	return allowSlide;
	};
	
	for (var i = 2; i < 5; i++) {
		$('#slide' + i + '-value').html(0);
		$('#slide' + i).slider({ 
			handle: '#slide' + 1 +'-Handel',
			range: "min",
			animate: true,
			min: 0,
			max: 100,
			value: 0,
			step: 1,
			slide: eh,
			change: eh
		});
	}
	
	$('a[data-slider-idx]').click(function() {
		var maxValue = getMaxValueForSlider();
		var dir = parseInt($(this).data('sliderDir'));
		if (maxValue > 0 || dir < 0) {
			var idx = parseInt($(this).data('sliderIdx'));
			var value = resourceSlides[idx].slider('value');
			resourceSlides[idx].slider('value', value + dir);
		}
	});
	
	$('a[data-slider-max-resource]').click(function() {
		var idx = $(this).data('sliderIdx');
		resourceSlides[idx].slider('value', getMaxValueForSlider(idx));
	});
	
    initializeSlider('slide1',0);
    
    
    // Add text input instead of label for 1 slider only
    $('#slide1-value-input').val(0);
    
    $('#slide1').bind('slide', function(event, ui) {
    	  $('#slide1-value-input').val(ui.value);
    });
    
    $('#slide1-value-input').bind('keyup', function(event, ui) {
    	var val = $('#slide1-value-input').val();
    	val = sliderMoveOn('slide1', val);
    	val = val <= 0 ? '' : val;
    	$('#slide1-value-input').val(val);
    });
    
});

 
function setMaxScrap() {
	var max = $('#slide1').slider('option', 'max');
	sliderMoveOn('slide1', max);
	$('#slide1-value-input').val(max);
}
 
function addRecycling() {
    var recycle = $('#slide1-value').html();
    var metal = $('#slide2-value').html();
    var crystal = $('#slide3-value').html();
    var gas = $('#slide4-value').html();

    $.post("ajax_recycling.php",{
				    recycling: recycle,
				    metal: metal,
				    crystal: crystal,
				    gas: gas,
				    type: 'add'
			    }, function(xml) {
				    var info = eval('(' + xml + ')');
				    if(info.status == '1') {
						//localStorage.clear();
						try {
						  localStorage.removeItem('expiretime');
						  localStorage.removeItem('positions');
						}
						catch(err) {}
						reloadRecyclingProcessesTable();
						refreshSession('planet');
						var max = $('#slide1-max').attr('title') - recycle;
						var moveTo = Math.min(max, recycle);
						sliderMoveOn('slide1', moveTo);
						$('#slide1-value-input').val(moveTo);
						sliderSetMax('slide1', max);
				    } else {
					    showDialogMessagePopup(info.reason);
				    }
				    return;
		    });
}

function takeResource(procId) {
	$.post("ajax_recycling.php",{
		    id: procId,
		    type: 'get'
	    }, function(xml) {
		    var info = eval('(' + xml + ')');
		    if(info.status == '1') {
			   reloadRecyclingProcessesTable();
			   refreshSession('planet');
		    } 
		    showDialogMessage(info.reason);
		    return;
    });
}

function cancelResource(procId) {
	showConfirm(LangString.CancelConfirm, function() {
		$.post("ajax_recycling.php", {
				id: procId,
				type: 'cancel'
			}, function(response) {
				var info = eval('(' + response + ')');
				if (info.status == '1') {
					reloadRecyclingProcessesTable();
					refreshSession('planet');
				}
				showDialogMessage(info.reason);
				return;
			});
	});
}

function boostResource(procId) {
    var tleft = $("#recyclingTimer-" + procId).html ();
    if (tleft == '-')
      return;

    tleft = tleft.split (':');
    if (tleft.length != 3)
       return;

    var mins = parseInt (tleft[0]) * 60 + parseInt (tleft[1]);

	showConfirm('Do you want 100% Boost for ' + mins*2 + ' credit?', function() {
		$.post("ajax_recycling.php", {
				id: procId,
				type: 'boost'
			}, function(response) {
				var info = eval('(' + response + ')');
				if (info.status == '1') {
				    reloadRecyclingProcessesTable();
				    refreshSession('planet');
				}
				showDialogMessage(info.reason);
				return;
			});
	});
}

function finishAllRecyclings() {
	$.post("ajax_recycling.php", {
		type: 'finishAllRecyclings'
	}, function() {
		reloadRecyclingProcessesTable();
	});
}

function reloadRecyclingProcessesTable() {
	$.post("ajax_recycling.php", {
		type: 'getProcessesTable'
	}, function(response) {
		Timers = new Array();
		CountTimers = 0;
		$('#recycleTable').html(response);
	});
}

CountDown();
