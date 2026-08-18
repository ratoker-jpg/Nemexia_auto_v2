opened = Array();
opened["b"]=false;
opened["u"]=false;
opened["i"]=false;
opened["s"]=false;
opened["url"]=false;
opened["img"]=false;
opened["email"]=false;
opened["color"]=false;
opened["size"]=false;
opened["bg"]=false;
opened["align"]=false;
keys = Array();
keys[0]="b";
keys[1]="u";
keys[2]="i";
keys[3]="s";
keys[4]="url";
keys[5]="img";
keys[6]="email";
keys[7]="color";
keys[8]="size";
keys[9]="bg";
keys[10]="align";
function bbcode_add(code,element_id) {
	if(!element_id)element_id='sendMessage';
	var info=document.getElementById(element_id).value;
	var tag="";	
	
	switch(code) {
		case 'b': if(opened['b']) {tag="[/b]"; opened['b']=false;} else { tag="[b]"; opened['b']=true; }
		break;
		case 'i': if(opened['i']) {tag="[/i]"; opened['i']=false;} else { tag="[i]"; opened['i']=true; }
		break;
		case 'u': if(opened['u']) {tag="[/u]"; opened['u']=false;} else { tag="[u]"; opened['u']=true; }
		break;
		case 's': if(opened['s']) {tag="[/s]"; opened['s']=false;} else { tag="[s]"; opened['s']=true; }
		break;
		case 'url': if(opened['url']) {tag="[/url]"; opened['url']=false;} else { tag="[url=]"; opened['url']=true; }
		break;
		case 'img': tag="[img=][/img]"; 
		break;
		case 'email': if(opened['email']) {tag="[/email]"; opened['email']=false;} else { tag="[email=]"; opened['email']=true; }
		break;
		case 'color': if(opened['color']) {tag="[/color]"; opened['color']=false;} else { tag="[color=]"; opened['color']=true; }
		break;
		case 'size': if(opened['size']) {tag="[/size]"; opened['size']=false;} else { tag="[size=]"; opened['size']=true; }
		break;
		case 'bg': if(opened['bg']) {tag="[/bg]"; opened['bg']=false;} else { tag="[bg=]"; opened['bg']=true; }
		break;
		case 'align': if(opened['align']) {tag="[/align]"; opened['align']=false;} else { tag="[align=]"; opened['align']=true; }
		break;
		
		// emoticons
		case 'smile': tag=":)";
		break;
		case 'tongue': tag=":p";
		break;
		case 'laugh': tag=":D";
		break;
		case 'wink': tag=";)";
		break;
		case 'sad': tag=":(";
		break;
		case 'scream': tag=":o";
		break;
		case 'wonder': tag=":wonder:";
		break;
		case 'blush': tag=":blush:";
		break;
		case 'cool': tag=":cool:";
		break;
		case 'cry': tag=":cry:";
		break;
		case 'kiss': tag=":{}";
		break;
	}
	$('#' + element_id).insertAtCaret(tag);
}
function add_closed_tags() {
	for(i=0; i<11; i++) {
		if(opened[keys[i]]) bbcode_add(keys[i]);
	}
}

$.fn.insertAtCaret = function (tagName) {
	return this.each(function(){
		if (document.selection) {
			//IE support
			this.focus();
			sel = document.selection.createRange();
			sel.text = tagName;
			this.focus();
		}else if (this.selectionStart || this.selectionStart == '0') {
			//MOZILLA/NETSCAPE support
			startPos = this.selectionStart;
			endPos = this.selectionEnd;
			scrollTop = this.scrollTop;
			this.value = this.value.substring(0, startPos) + tagName + this.value.substring(endPos,this.value.length);
			this.focus();
			this.selectionStart = startPos + tagName.length;
			this.selectionEnd = startPos + tagName.length;
			this.scrollTop = scrollTop;
		} else {
			this.value += tagName;
			this.focus();
		}
	});
};