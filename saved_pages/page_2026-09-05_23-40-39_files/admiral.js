var ajaxAdmiralUrl = 'ajax_admiral.php';

function loadTabContent(tabId, callback){
	$.post(ajaxAdmiralUrl+'?uid='+(new Date()).valueOf(), {
		type: 'ajaxTab',
		tabId: tabId
	}, function(response){
		$('#'+tabId).html(response);
		showTab(tabId);

		if(typeof(callback) != 'undefined' ){
			if( typeof(callback) == 'string' ) {
				eval(callback);
			} else if( typeof(callback) == 'function') {
				callback.call();
			}
		}
	});
	return false;
}

function updateAdmiralElementsDisplay(count) {
	$('#admiralEquipmentElementsCounter').attr('data-elements-count', count);
	$('#admiralEquipmentElementsCounter').find('span').html(number_format(count));
}

function onSaveSkillsClick() {
	showConfirm(RUSure, function(){

		$('#treeSkillsSaveBtn').unbind('click');

		skillsManager.save(function(){
			$('#treeSkillsSaveBtn').bind('click', function(){
				onSaveSkillsClick();
			});
		}, function() {
			loadTabContent('tabSkills');
		});

	});
}

function skillsResetMenuLoad() {
	floatingEnable = 0;
	$("#dialogMessage").addClass('skillsResetMenu');

	$.post(ajaxAdmiralUrl, {
		type: 'showSkillsResetMenu'
	}, function(response){
		$("#dialogBox").html(response);
		$('#dialogMessage').fadeIn('fast');
	});
}

function skillsResetMenuClose(callback) {
	$('#dialogMessage').fadeOut('slow', function() {
		$("#dialogMessage").removeClass('skillsResetMenu');
		floatingEnable = 1;

		if (undefined !== callback) {
			if (typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
	});
}

function skillsReset(paymentMethod) {
	$.post(ajaxAdmiralUrl, {
		type: 'skillsReset',
		pmethod: paymentMethod
	}, function(response){
		var info = eval('('+ response + ')');

		refreshSession('session');
		if (info.status == true) {
			skillsResetMenuClose();
			loadTabContent('tabSkills');
			showDialogMessage(info.message);
		} else {
			showDialogMessagePopup(info.message, skillsResetMenuLoad);
		}
	});
}

function statUpgrade(statId) {
	$.post(ajaxAdmiralUrl, {
		type: 'abilityUpgrade',
		name: statId,
		pmethod: 2
	}, function(response){
		var info = eval('('+ response + ')');

		refreshSession('session', function() {
			firePremiumPopupEvent('resourceIncomeChange');
		});
		loadTabContent('tabStats');
		showDialogMessage(info.message);
		if(info.status == true){
			//localStorage.clear();
			try {
			  localStorage.removeItem('expiretime');
			  localStorage.removeItem('positions');
			}
			catch(err) {
			  
			}
		}
	});
}

function admiralEditMenuLoad() {
	floatingEnable = 0;
	$("#dialogMessage").addClass('admiralEditMenu');

	$.post(ajaxAdmiralUrl, {
		type: 'showAdmiralEditMenu'
	}, function(response){
		$("#dialogBox").html(response);
		$('#dialogMessage').fadeIn('fast');
	});
}

function admiralEditMenuClose(callback) {
	$('#dialogMessage').fadeOut('slow', function() {
		$("#dialogMessage").removeClass('admiralEditMenu');
		floatingEnable = 1;

		if (undefined !== callback) {
			if (typeof(callback) == 'string') {
				eval(callback);
			} else if (typeof(callback) == 'function') {
				callback.call();
			}
		}
	});
}

function admiralNameSave() {
	$.post(ajaxAdmiralUrl, {
		type: 'admiralSetName',
		name: $('#editNameInput').val()
	}, function(response){
		var info = eval('('+ response + ')');

		if (info.status == true) {
			showDialogMessagePopup(info.message, function(){
				document.location.reload(true);
			});
		} else {
			showDialogMessagePopup(info.message, function(){
				admiralEditMenuLoad();
			});
		}
	});
}

function admiralImageUse(imageId) {
	$.post(ajaxAdmiralUrl, {
		type: 'admiralSetImage',
		image_id: imageId
	}, function(response){
		var info = eval('('+ response + ')');

		if (info.status == true) {
			$('.admiralImageItem').removeClass('active');
			$('.admiralImageItem input').val(ADMIRAL_IMAGE_USE);

			$('#admiralImage_' + imageId).addClass('active');
			$('#admiralImage_' + imageId + ' input').val(ADMIRAL_IMAGE_ACTIVE);
		}
	});
}

function MultipleTree(containerSelector, controlsList) {
	this.container = $(containerSelector);
	this.controlsList = controlsList;

	this.init = function() {

		this.protectorsAddHoverEvents();
		this.controlsAddEvents();
		this.controlsAddHoverEffects();
		this.layersAddEventClickBack();

		this.layerFocus(this.controlsList[0][0], this.controlsList[0][1]);
	}

	this.controlsAddEvents = function() {
		var _this = this;
		for(i = 0; i < this.controlsList.length; i++) {
			$(this.controlsList[i][0]).bind('click', {
				index: i
			}, function(event){
				_this.layerFocus(_this.controlsList[event.data.index][0], _this.controlsList[event.data.index][1]);
			});
		}
	}

	this.controlsAddHoverEffects = function() {
		var _this = this;
		for(i = 0; i < this.controlsList.length; i++) {
			$(this.controlsList[i][0]).bind('mouseover', {
				index: i
			}, function(event){
				_this.layerDim(false, _this.controlsList[event.data.index][1])
			});

			$(this.controlsList[i][0]).bind('mouseout', {
				index: i
			}, function(event){
				_this.layerDim(true, _this.controlsList[event.data.index][1])
			});
		}
	}

	this.protectorsAddHoverEvents = function() {
		this.container.find('.protector').bind('mouseover', function(){
			$(this).siblings().trigger('mouseover');
		});

		this.container.find('.protector').bind('mouseout', function(){
			$(this).siblings().trigger('mouseout');
		});
	}
	
	this.layersAddEventClickBack = function() {
		var _this = this;
		
		for(i = 0; i < this.controlsList.length; i++) {
			$(controlsList[i][1]).bind('click', {index: i}, function(event) {
				if ($(this).attr('class') != "layer layer0") {
					_this.layerFocus(_this.controlsList[event.data.index][0], _this.controlsList[event.data.index][1]);
				}
			});
		}
	}

	this.protectorsReset = function() {
		this.container.find('.layer .leaf .protector').hide();
		this.container.find('.layer[class != "layer layer0"] .leaf .protector').show();
	}

	this.backgroundLayersHoverAddDimming = function() {
		var _this = this;
		var elements = this.container.find('.layer[class != "layer layer0"] .leaf');

		elements.each(function(){
			_this.leafDim(true, this)
		});

		elements.bind('mouseover', this, function(){
			_this.leafDim(false, this);
		});

		elements.bind('mouseout', this, function(){
			_this.leafDim(true, this);
		});
	}

	this.backgroundLayersHoverRemoveDimming = function() {
		var _this = this;
		var elements = this.container.find('.layer .leaf');

		elements.unbind('mouseover');
		elements.unbind('mouseout');

		elements.each(function(){
			_this.leafDim(false, this)
		});
	}
	
	this.layerFocus = function(tabBtnSelctor, layerSelector) {
		this.backgroundLayersHoverRemoveDimming();

		this.container.find('.layer').not(layerSelector).each(function(index){
			$(this).attr('class', "layer layer" + (index + 1));
		});

		this.container.find(layerSelector).attr('class', "layer layer0");

		$('.multipleTreeTabBtn').removeClass('active');
		$(tabBtnSelctor).addClass('active');

		this.protectorsReset();
		this.backgroundLayersHoverAddDimming();
	}

	this.layerDim = function(status, layerSelector) {
		var _this = this;
		var elements = this.container.find(layerSelector).not('.layer0').find('.leaf');

		if (status == true) {
			elements.each(function(){
				_this.leafDim(true, this)
			});
		} else {
			elements.each(function(){
				_this.leafDim(false, this)
			});
		}
	}

	this.leafDim = function(status, leafSelector) {
		var element = $(leafSelector);
		if (status == true) {
			element.addClass('dimmed');
		} else {
			element.removeClass('dimmed');
		}
	}
}

function SkillsManager(skillPoints, tierRequirements, skillsList, treeControls, skillPointsDispSelector) {
	this.hoveredElementFlag = false;

	this.skillPoints = skillPoints;

	this.skillsList = skillsList;

	this.treeControls = treeControls;

	this.skillPointsDisp = $(skillPointsDispSelector);

	this.tierRequirements = tierRequirements;

	this.init = function() {
		this.fillInitalInfo();
		this.addListeners();

		this.refreshTreeStatus();
	}

	this.save = function(successCallback, failCallback) {
		var _this = this;

		var skillsInitState = {};
		var skillsDelta = {};

		for (skillId in this.skillsList) {
			var skill = this.skillsList[skillId];

			skillsInitState[skillId] = skill.levelCurrent;
			skillsDelta[skillId] = skill.levelDelta;
		}

		$.post(ajaxAdmiralUrl, {
			type: 'skillsUpgradeMultiple',
			dataInitState: $.param(skillsInitState),
			dataDelta: $.param(skillsDelta)
		}, function(response) {
			var info = eval('('+ response + ')');

			if (info.status == true) {
				for (skillId in _this.skillsList) {
					var skill = _this.skillsList[skillId];
					if (skill.levelDelta <= 0) {
						continue;
					}
		
					skill.levelCurrent += skill.levelDelta;
					skill.levelDelta = 0;
					
					_this.refreshInfo(skillId);
				}
				showDialogMessage(info.message);
				executeCallback(successCallback);
			} else {
				showDialogMessagePopup(info.message, failCallback);
			}
		});
	}

	this.refreshDisplays = function() {
		for (treeGroup in this.treeControls) {
			$(this.treeControls[treeGroup]).find('.tabSpentPointsDisp').html(this.getTreePoinsSum(treeGroup));
		}

		this.skillPointsDisp.html(this.skillPoints);
	}

	this.fillInitalInfo = function() {
		for (skillId in this.skillsList) {
			var skillContainer = $('#Container' + skillId);
			var skill = this.skillsList[skillId];
			skillContainer.find('.name').html(skill.name);
			skillContainer.find('.levelMax').html(skill.levelMax);
			skillContainer.find('.bonusUnit').html(skill.bonusUnit);

			if (this.tierRequirements[skill.treeTier] == 0) {
				skillContainer.find('.containerRequirement').hide();
			}

			this.refreshInfo(skillId);
		}
	}

	this.refreshInfo = function(skillId) {
		var skillContainer = $('#Container' + skillId);
		var skill = this.skillsList[skillId];

		var currentLevel = skill.levelCurrent + skill.levelDelta;

		skillContainer.find('.levelCurrent').html(currentLevel);

		skillContainer.find('.bonusCurrent').html(skill.bonusPerLevel * currentLevel);
		skillContainer.find('.bonusNext').html(skill.bonusPerLevel * (currentLevel + 1));

		skillContainer.find('.spentSkillPoints').html(currentLevel * skill.pointsPerLevel);
		
		if (skill.levelDelta > 0) {
			skillContainer.find('.downgradeBtn').show();
		} else {
			skillContainer.find('.downgradeBtn').hide();
		}

		if (currentLevel == 0) {
			skillContainer.find('.containerBonusCurrent').hide();
		} else {
			skillContainer.find('.containerBonusCurrent').show();
		}

		if (currentLevel >= skill.levelMax) {
			skillContainer.find('.containerBonusNext').hide();
		} else {
			skillContainer.find('.containerBonusNext').show();
		}

		if (this.hoveredElementFlag == true) {
			Tip(skillContainer.find('.tooltip').html());
		}
	}

	this.refreshTreeStatus = function() {
		for (skillId in this.skillsList) {
			var skillContainer = $('#Container' + skillId);
			var skill = this.skillsList[skillId];

			skillContainer.removeClass('inactive');
			skillContainer.removeClass('active');

			if (skill.levelCurrent + skill.levelDelta >= skill.levelMax) {
				continue;
			}

			if (this.tierRequirements[skill.treeTier] > this.getTreePoinsSum(skill.treeGroup)) {
				skillContainer.addClass('inactive');
			} else if (skill.pointsPerLevel <= this.skillPoints) {
				skillContainer.addClass('active');
			}
		}

		this.refreshDisplays();
	}

	this.addListeners = function() {
		var _this = this;

		for (skillId in this.skillsList) {
			var skillContainer = $('#Container' + skillId);

			skillContainer.hover(
				function() {
					Tip($(this).find('.tooltip').html());
					_this.hoveredElementFlag = true;
				}, function() {
					UnTip();
					_this.hoveredElementFlag = false;
				});

			skillContainer.bind('click', {
				skillId: skillId
			}, function(event) {
				_this.levelAlter(event.data.skillId, 1);
			});

			skillContainer.find('.downgradeBtn').bind('click', {
				skillId: skillId
			}, function(event) {
				event.stopPropagation();
				_this.levelAlter(event.data.skillId, -1);
			});
		}
	}

	this.getTreePoinsSum = function(treeGroup, treeTier) {
		var pointsSum = 0;
		for (skillId in this.skillsList) {
			var skill = this.skillsList[skillId];

			if (treeGroup != undefined && skill.treeGroup != treeGroup) {
				continue;
			}

			if (treeTier != undefined && skill.treeTier != treeTier) {
				continue;
			}

			pointsSum += (skill.levelCurrent + skill.levelDelta) * skill.pointsPerLevel;
		}

		return pointsSum;
	}

	this.checkHaveDependencies = function(skillId) {
		var skill = this.skillsList[skillId];

		var tiersPointsSum = {};
		for (tierId in this.tierRequirements) {
			if (isNaN(tiersPointsSum[tierId])) {
				tiersPointsSum[tierId] = 0;
			}
			tiersPointsSum[tierId] += this.getTreePoinsSum(skill.treeGroup, tierId);
		}

		tiersPointsSum[skill.treeTier] -= skill.pointsPerLevel;

		var pointsSum = 0;
		for (tierId in tiersPointsSum) {
			if (this.tierRequirements[tierId] > pointsSum && tiersPointsSum[tierId] > 0) {
				return true;
			}
			pointsSum += tiersPointsSum[tierId];
		}

		return false;
	}

	this.levelAlter = function(skillId, direction) {
		var skill = this.skillsList[skillId];

		if (direction > 0) {
			if (skill.levelCurrent + skill.levelDelta >= skill.levelMax) {
				return false;
			}

			if (skill.pointsPerLevel > this.skillPoints) {
				return false;
			}

			if (this.tierRequirements[skill.treeTier] > this.getTreePoinsSum(skill.treeGroup)) {
				return false;
			}
		} else if (direction < 0) {
			if (skill.levelDelta <= 0) {
				return false;
			}

			if (this.checkHaveDependencies(skillId)) {
				return false;
			}
		}

		skill.levelDelta += direction;
		this.skillPoints += skill.pointsPerLevel * -1 * direction;

		this.refreshInfo(skillId);
		this.refreshTreeStatus();

		return true;
	}

}