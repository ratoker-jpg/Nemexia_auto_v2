var Forum = {
	// Misc
	request: function(params, tabId, tabParams) {
		$.post(ajaxUniqueAllianceUrl(), params, function(response) {
			var info = eval('('+ response + ')');
			
			if(info.status > 0) {
				Forum.showTab(tabId, tabParams);
			}
			
			if(isset(info.response)) {
				showDialogMessage(info.response);
			}
		});
		
		return false;
	},
	
	showTab: function(tabId, params) {
		return loadTabContent(tabId, function() { showTab(tabId); }, params);
	},
	
	toggle_options: function(topic_id) {
		$('.topicOptions').hide();
		$('.toggleOptions').show();
		$('#topic_' + topic_id + '_options').show();
		$('#topic_' + topic_id + '_toggle').hide();
	},
	
	// Categories
	category_create: function() {
		return Forum.request({ type: 'category_create', cat_name: $('#cat_name').val() }, 'forumTab');
	},
	
	
	category_edit: function(cat_id, action) {
		if(action == 'edit') {
			$('.rowForm').hide();
			$('#a_cat_' + cat_id).hide();
			$('#editCatForm_' + cat_id).show();
			
		} else if (action == 'save') {
			Forum.request({ type: 'category_edit', cat_id: cat_id, cat_name: $('#txt_cat_name_'+cat_id).val() }, 'forumTab');
		}
		
		return false;
	},
	
	category_delete: function(cat_id) {
		return Forum.request({ type: 'category_delete', cat_id: cat_id }, 'forumTab');
	},

	// Topics
	topic_create: function(cat_id) {
		return Forum.request({ type: 'topic_create', cat_id: cat_id,
			topic_name: $('#topic_name').val(), post_body: $('#topic_newPost').val() }, 'forumTopicsTab', { cat_id: cat_id });
	},
	
	topic_edit: function(topic_id, action, cat_id) {
		if(action == 'edit') {
			$('.rowForm').hide();
			$('.topicTitle').show();
			$('#a_topic_'+topic_id).hide();
			$('#editTopicForm_'+topic_id).show();
			
		} else if(action == 'save') {
			Forum.request({ type: 'topic_edit', topic_id: topic_id, topic_name: $('#txt_topic_name_' + topic_id).val() }, 'forumTopicsTab', { cat_id: cat_id });
		}
		
		return false;
	},
	
	topic_mark: function(topic_id, sticky, cat_id) {
		if(undefined === sticky) sticky = 0;
		
		return Forum.request({ type: 'topic_mark', topic_id: topic_id, sticky: sticky }, 'forumTopicsTab', { cat_id: cat_id });
	},
	
	topic_delete: function(topic_id, cat_id) {
		return Forum.request({ type: 'topic_delete', topic_id: topic_id }, 'forumTopicsTab', { cat_id: cat_id });
	},

	// Posts
	post_create: function(topic_id, cat_id) {
		Forum.request({ type: 'post_create', topic_id: topic_id, post_body: $('#post_body').val() }, 'forumTopicPostsTab', { cat_id: cat_id, topic_id: topic_id });
		
		return false;
	},
	
	post_edit: function(post_id, action, cat_id, topic_id) {
		if(action == 'edit') {
		  $('.rowForm').hide();
		  $('.forumMessage').show();
		  $('#forum_message_'+post_id).hide();
		  $('#editPostForm_'+post_id).show();
		  
		} else if(action == 'save') {
			Forum.request({ type: 'post_edit', post_id: post_id, body: $('#ta_post_body_'+post_id).val() }, 'forumTopicPostsTab', { cat_id: cat_id, topic_id: topic_id });
		}
		
		return false;
	},
	
	post_delete: function(post_id, cat_id, topic_id) {
		Forum.request({ type: 'post_delete', post_id: post_id }, 'forumTopicPostsTab', { cat_id: cat_id, topic_id: topic_id });
	},

	category_move: function(cat_id, direction) {
		Forum.request({type: 'category_move', cat_id: cat_id, direction: direction}, 'forumTab');
	}
}