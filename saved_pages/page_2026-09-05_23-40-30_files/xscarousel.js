function xscarousel(containerSelector, elemSelector, perPage, goLeftElemSelector, goRightElemSelctor) {
	this.container = $(containerSelector);
	this.elemSelector = elemSelector;
	this.perPage = perPage;
	
	this.goLeftElem = $(goLeftElemSelector);
	this.goRightElem = $(goRightElemSelctor);
	
	this.slideNextDirection = 'left';
	
	this.onMoveCallbacks = [];

	this.init = function() {
		this.addControlListeners();
	}
	
	this.addOnMoveCallback = function(callback) {
		this.onMoveCallbacks.unshift(callback);
	};

	this.addControlListeners = function() {
		this.goLeftElem.bind('click', this, function(event){
			event.data.slideLeft();
		});
		this.goRightElem.bind('click', this, function(event){
			event.data.slideRight();
		});
	}
	
	this.removeControlListeners = function() {
		this.goLeftElem.unbind('click');
		this.goRightElem.unbind('click');
	}
	
	this.slideLeft = function() {
		this.doMove(this.slideCalcDelta(-1));
	}
					
	this.slideRight = function() {
		this.doMove(this.slideCalcDelta(1));
	}
	
	this.slideToPage = function(page) {
		if (page >= this.getPageCount() || page < 0) {
			return;
		}
		
		var pagesDelta = page - this.getCurrenPageNumber();
		
		if (pagesDelta == 0) {
			return;
		} else {
			this.doMove(this.slideCalcDelta(pagesDelta));
		}
	}
	
	this.doMove = function(delta) {
		if (delta === 0) {
			return;
		}

		this.removeControlListeners();
		
		var _this = this;

		if (this.slideNextDirection == 'left') {
			this.container.animate({
				left: '+=' + delta
			}, function(){
				_this.addControlListeners();
				_this._onMove();
			});
		} else if (this.slideNextDirection == 'right') {
			this.container.animate({
				right: '+=' + delta
			}, function(){
				_this.addControlListeners();
				_this._onMove();
			});
		}
	}
	
	this.slideCalcDelta = function(pagesDelta) {
		var slideDelta = -1 * pagesDelta * this.getOneElementWidth() * this.perPage;
		var nextPage = this.getCurrenPageNumber() + pagesDelta;
		
		if (nextPage >= this.getPageCount() || nextPage < 0) {
			slideDelta = 0;
		}
		
		return slideDelta;
	}
	
	this.getPageCount = function() {
		var pagesCount = Math.ceil(this.getElems().length / this.perPage);
		return pagesCount;
	}
	
	this.getCurrenPageNumber = function() {
		var currentPage = (-1 * parseInt(this.container.css(this.slideNextDirection)) / this.getOneElementWidth() / this.perPage);
		return currentPage;
	}
	
	this.getElementPageNumber = function(elem) {
		return Math.ceil((this.getElems().index(elem) + 1) / this.perPage) - 1;
	}

	this.getOneElementWidth = function() {
		var oneElemWidth = 0;
		var elems = this.getElems();
		
		oneElemWidth += parseInt(elems.css('width'));
		oneElemWidth += parseInt(elems.css('margin-left'));
		oneElemWidth += parseInt(elems.css('margin-right'));
		oneElemWidth += parseInt(elems.css('borderRightWidth'));
		oneElemWidth += parseInt(elems.css('borderLeftWidth'));
		
		return oneElemWidth;
	}

	this.getElems = function() {
		return $(this.elemSelector);
	}

	this._onMove = function() {
		for (var i = 0; i < this.onMoveCallbacks.length; i++) {
			this.onMoveCallbacks[i]();
		}
	}
}