const htmlparser = require('htmlparser2');
const {MessageEmbed} = require('discord.js');
const global_block = require('../../../functions/global_block.js');
const parse_page = require('../../../functions/parse_page.js');
const extract_desc = require('../../../util/extract_desc.js');
const {timeoptions, usergroups} = require('../../../util/default.json');

var allSites = [];
const getAllSites = require('../../../util/allSites.js');
getAllSites.then( sites => allSites = sites );

/**
 * Processes a Gamepedia user.
 * @param {import('../../../util/i18n.js')} lang - The user language.
 * @param {import('discord.js').Message} msg - The Discord message.
 * @param {String} namespace - The user namespace on the wiki.
 * @param {String} username - The name of the user.
 * @param {String} wiki - The wiki for the page.
 * @param {String} querystring - The querystring for the link.
 * @param {String} fragment - The section for the link.
 * @param {Object} querypage - The user page on the wiki.
 * @param {String} contribs - The contributions page on the wiki.
 * @param {import('discord.js').MessageReaction} reaction - The reaction on the message.
 * @param {String} spoiler - If the response is in a spoiler.
 */
function gamepedia_user(lang, msg, namespace, username, wiki, querystring, fragment, querypage, contribs, reaction, spoiler) {
	if ( !allSites.length ) getAllSites.update();
	if ( /^(?:(?:\d{1,3}\.){3}\d{1,3}(?:\/\d{2})?|(?:[\dA-F]{1,4}:){7}[\dA-F]{1,4}(?:\/\d{2,3})?)$/.test(username) ) {
		got.get( wiki + 'api.php?action=query&meta=siteinfo&siprop=general&list=blocks&bkprop=user|by|timestamp|expiry|reason&bkip=' + encodeURIComponent( username ) + '&format=json' ).then( response => {
			var body = response.body;
			if ( body && body.warnings ) log_warn(body.warnings);
			if ( response.statusCode !== 200 || !body || body.batchcomplete === undefined || !body.query || !body.query.blocks || fragment ) {
				if ( body && body.error && ( body.error.code === 'param_ip' || body.error.code === 'cidrtoobroad' ) || fragment ) {
					if ( querypage.missing !== undefined || querypage.ns === -1 ) msg.reactEmoji('error');
					else {
						var pagelink = wiki.toLink(querypage.title, querystring.toTitle(), fragment);
						var embed = new MessageEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
						if ( querypage.pageprops && querypage.pageprops.displaytitle ) {
							var displaytitle = htmlToDiscord( querypage.pageprops.displaytitle );
							if ( displaytitle.length > 250 ) displaytitle = displaytitle.substring(0, 250) + '\u2026';
							embed.setTitle( displaytitle );
						}
						if ( querypage.extract ) {
							var extract = extract_desc(querypage.extract, fragment);
							embed.setDescription( extract[0] );
							if ( extract[2].length ) embed.addField( extract[1], extract[2] );
						}
						if ( querypage.pageprops && querypage.pageprops.description ) {
							var description = htmlToPlain( querypage.pageprops.description );
							if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
							embed.setDescription( description );
						}
						if ( querypage.pageimage && querypage.original ) {
							var pageimage = querypage.original.source;
							embed.setThumbnail( pageimage );
						} else embed.setThumbnail( logoToURL(body.query.general) );
						
						msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, {embed} ).then( message => parse_page(message, querypage.title, embed, wiki, ( querypage.title === body.query.general.mainpage ? '' : logoToURL(body.query.general) )) );
					}
				}
				else {
					console.log( '- ' + response.statusCode + ': Error while getting the search results: ' + ( body && body.error && body.error.info ) );
					msg.sendChannelError( spoiler + '<' + wiki.toLink(( querypage.noRedirect ? namespace : contribs ) + username, querystring.toTitle(), fragment) + '>' + spoiler );
				}
				
				if ( reaction ) reaction.removeEmoji();
			}
			else {
				if ( !querypage.noRedirect || ( querypage.missing === undefined && querypage.ns !== -1 ) ) namespace = contribs;
				var blocks = body.query.blocks.map( block => {
					var isBlocked = false;
					var blockedtimestamp = new Date(block.timestamp).toLocaleString(lang.get('dateformat'), timeoptions);
					var blockexpiry = block.expiry;
					if ( ['infinity', 'infinite'].includes(blockexpiry) ) {
						blockexpiry = lang.get('user.block.until_infinity');
						isBlocked = true;
					} else if ( blockexpiry ) {
						if ( Date.parse(blockexpiry) > Date.now() ) isBlocked = true;
						blockexpiry = new Date(blockexpiry).toLocaleString(lang.get('dateformat'), timeoptions);
					}
					if ( isBlocked ) return {
						header: lang.get('user.block.header', block.user, 'unknown').escapeFormatting(),
						text: lang.get('user.block.' + ( block.reason ? 'text' : 'noreason' ), blockedtimestamp, blockexpiry),
						by: block.by,
						reason: block.reason
					};
				} ).filter( block => block !== undefined );
				if ( username.includes( '/' ) ) {
					var rangeprefix = username;
					if ( username.includes( ':' ) ) {
						var range = parseInt(username.replace( /^.+\/(\d{2,3})$/, '$1' ), 10);
						if ( range === 128 ) username = username.replace( /^(.+)\/\d{2,3}$/, '$1' );
						else if ( range >= 112 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){7}).+$/, '$1' );
						else if ( range >= 96 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){6}).+$/, '$1' );
						else if ( range >= 80 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){5}).+$/, '$1' );
						else if ( range >= 64 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){4}).+$/, '$1' );
						else if ( range >= 48 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){3}).+$/, '$1' );
						else if ( range >= 32 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){2}).+$/, '$1' );
						else if ( range >= 19 ) rangeprefix = username.replace( /^((?:[\dA-F]{1,4}:){1}).+$/, '$1' );
					}
					else {
						var range = parseInt(username.substring(username.length - 2), 10);
						if ( range === 32 ) username = username.replace( /^(.+)\/\d{2}$/, '$1' );
						else if ( range >= 24 ) rangeprefix = username.replace( /^((?:\d{1,3}\.){3}).+$/, '$1' );
						else if ( range >= 16 ) rangeprefix = username.replace( /^((?:\d{1,3}\.){2}).+$/, '$1' );
					}
				}
				got.get( wiki + 'api.php?action=query&list=usercontribs&ucprop=&uclimit=50' + ( username.includes( '/' ) ? '&ucuserprefix=' + encodeURIComponent( rangeprefix ) : '&ucuser=' + encodeURIComponent( username ) ) + '&format=json' ).then( ucresponse => {
					var ucbody = ucresponse.body;
					if ( rangeprefix && !username.includes( '/' ) ) username = rangeprefix;
					if ( ucbody && ucbody.warnings ) log_warn(ucbody.warnings);
					if ( ucresponse.statusCode !== 200 || !ucbody || ucbody.batchcomplete === undefined || !ucbody.query || !ucbody.query.usercontribs ) {
						if ( ucbody && ucbody.error && ucbody.error.code === 'baduser_ucuser' ) {
							msg.reactEmoji('error');
						}
						else {
							console.log( '- ' + ucresponse.statusCode + ': Error while getting the search results: ' + ( ucbody && ucbody.error && ucbody.error.info ) );
							msg.sendChannelError( spoiler + '<' + wiki.toLink(namespace + username, querystring.toTitle(), fragment, body.query.general) + '>' + spoiler );
						}
					}
					else {
						var editcount = [lang.get('user.info.editcount'), ( username.includes( '/' ) && ( ( username.includes( ':' ) && range % 16 ) || range % 8 ) ? '~' : '' ) + ucbody.query.usercontribs.length + ( ucbody.continue ? '+' : '' )];
						
						var pagelink = wiki.toLink(namespace + username, querystring.toTitle(), fragment, body.query.general);
						if ( msg.showEmbed() ) {
							var text = '<' + pagelink + '>';
							var embed = new MessageEmbed().setAuthor( body.query.general.sitename ).setTitle( username ).setURL( pagelink ).addField( editcount[0], '[' + editcount[1] + '](' + wiki.toLink(contribs + username, '', '', body.query.general, true) + ')' );
							if ( querypage.pageprops && querypage.pageprops.description ) {
								var description = htmlToPlain( querypage.pageprops.description );
								if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
								embed.setDescription( description );
							}
							else if ( querypage.extract ) {
								var extract = extract_desc(querypage.extract);
								embed.setDescription( extract[0] );
							}
							if ( blocks.length ) blocks.forEach( block => {
								block.text = block.text.replaceSave( /\$3/g, '[' + block.by.escapeFormatting() + '](' + wiki.toLink('User:' + block.by, '', '', body.query.general, true) + ')' );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toMarkdown(wiki, body.query.general) );
								embed.addField( block.header, block.text );
							} );
						}
						else {
							var embed = {};
							var text = '<' + pagelink + '>\n\n' + editcount.join(' ');
							if ( blocks.length ) blocks.forEach( block => {
								block.text = block.text.replaceSave( /\$3/g, block.by.escapeFormatting() );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toPlaintext() );
								text += '\n\n**' + block.header + '**\n' + block.text;
							} );
						}
						
						if ( msg.channel.type === 'text' && msg.guild.id in patreons && ( wiki.isFandom() || wiki.endsWith( '.gamepedia.com/' ) ) ) {
							if ( msg.showEmbed() ) embed.addField( '\u200b', '<a:loading:641343250661113886> **' + lang.get('user.info.loading') + '**' );
							else text += '\n\n<a:loading:641343250661113886> **' + lang.get('user.info.loading') + '**';

							msg.sendChannel( spoiler + text + spoiler, {embed} ).then( message => global_block(lang, message, username, text, embed, wiki, spoiler) );
						}
						else msg.sendChannel( spoiler + text + spoiler, {embed} );
					}
				}, error => {
					if ( rangeprefix && !username.includes( '/' ) ) username = rangeprefix;
					console.log( '- Error while getting the search results: ' + error );
					msg.sendChannelError( spoiler + '<' + wiki.toLink(namespace + username, querystring.toTitle(), fragment, body.query.general) + '>' + spoiler );
				} ).finally( () => {
					if ( reaction ) reaction.removeEmoji();
				} );
			}
		}, error => {
			console.log( '- Error while getting the search results: ' + error );
			msg.sendChannelError( spoiler + '<' + wiki.toLink(( querypage.noRedirect ? namespace : contribs ) + username, querystring.toTitle(), fragment) + '>' + spoiler );
			
			if ( reaction ) reaction.removeEmoji();
		} );
	} else {
		got.get( wiki + 'api.php?action=query&meta=allmessages|siteinfo&ammessages=custom-Wiki_Manager&amenableparser=true&siprop=general&list=users&usprop=blockinfo|groups|groupmemberships|editcount|registration|gender&ususers=' + encodeURIComponent( username ) + '&format=json' ).then( response => {
			var body = response.body;
			if ( body && body.warnings ) log_warn(body.warnings);
			if ( response.statusCode !== 200 || !body || body.batchcomplete === undefined || !body.query || !body.query.users || !body.query.users[0] ) {
				console.log( '- ' + response.statusCode + ': Error while getting the search results: ' + ( body && body.error && body.error.info ) );
				msg.sendChannelError( spoiler + '<' + wiki.toLink(namespace + username, querystring.toTitle(), fragment) + '>' + spoiler );
				
				if ( reaction ) reaction.removeEmoji();
			}
			else {
				var queryuser = body.query.users[0];
				if ( queryuser.missing !== undefined || queryuser.invalid !== undefined || fragment ) {
					if ( querypage.missing !== undefined || querypage.ns === -1 ) msg.reactEmoji('🤷');
					else {
						var pagelink = wiki.toLink(querypage.title, querystring.toTitle(), fragment, body.query.general);
						var embed = new MessageEmbed().setAuthor( body.query.general.sitename ).setTitle( querypage.title.escapeFormatting() ).setURL( pagelink );
						if ( querypage.pageprops && querypage.pageprops.displaytitle ) {
							var displaytitle = htmlToDiscord( querypage.pageprops.displaytitle );
							if ( displaytitle.length > 250 ) displaytitle = displaytitle.substring(0, 250) + '\u2026';
							embed.setTitle( displaytitle );
						}
						if ( querypage.extract ) {
							var extract = extract_desc(querypage.extract, fragment);
							embed.setDescription( extract[0] );
							if ( extract[2].length ) embed.addField( extract[1], extract[2] );
						}
						if ( querypage.pageprops && querypage.pageprops.description ) {
							var description = htmlToPlain( querypage.pageprops.description );
							if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
							embed.setDescription( description );
						}
						if ( querypage.pageimage && querypage.original ) {
							var pageimage = querypage.original.source;
							embed.setThumbnail( pageimage );
						} else embed.setThumbnail( logoToURL(body.query.general) );
						
						msg.sendChannel( spoiler + '<' + pagelink + '>' + spoiler, {embed} ).then( message => parse_page(message, querypage.title, embed, wiki, ( querypage.title === body.query.general.mainpage ? '' : logoToURL(body.query.general) )) );
					}
					
					if ( reaction ) reaction.removeEmoji();
				}
				else {
					username = queryuser.name;
					var gender = [lang.get('user.info.gender')];
					switch (queryuser.gender) {
						case 'male':
							gender.push(lang.get('user.gender.male'));
							break;
						case 'female':
							gender.push(lang.get('user.gender.female'));
							break;
						case 'unknown':
						default: 
							gender.push(lang.get('user.gender.unknown'));
					}
					var registration = [lang.get('user.info.registration'), new Date(queryuser.registration).toLocaleString(lang.get('dateformat'), timeoptions)];
					var editcount = [lang.get('user.info.editcount'), queryuser.editcount];
					var groups = queryuser.groups;
					var group = [lang.get('user.info.group')];
					for ( var i = 0; i < usergroups.length; i++ ) {
						if ( groups.includes( usergroups[i] ) && ( group.length === 1 || !['autoconfirmed', 'user'].includes( usergroups[i] ) ) ) {
							let thisSite = allSites.find( site => site.wiki_domain === body.query.general.servername );
							if ( usergroups[i] === 'wiki_manager' && thisSite && thisSite.wiki_managers.includes( username ) ) {
								group.push('**' + lang.get('user.groups.' + usergroups[i], queryuser.gender) + '**');
							}
							else if ( usergroups[i] === 'wiki-manager' && body.query.allmessages[0]['*'] === username ) {
								group.push('**' + lang.get('user.groups.' + usergroups[i], queryuser.gender) + '**');
							}
							else if ( !groups.includes( 'global_' + usergroups[i] ) || queryuser.groupmemberships.some( member => member.group === usergroups[i] ) ) {
								group.push(lang.get('user.groups.' + usergroups[i], queryuser.gender));
							}
						}
					}
					var isBlocked = false;
					var blockedtimestamp = new Date(queryuser.blockedtimestamp).toLocaleString(lang.get('dateformat'), timeoptions);
					var blockexpiry = queryuser.blockexpiry;
					if ( ['infinity', 'infinite'].includes(blockexpiry) ) {
						blockexpiry = lang.get('user.block.until_infinity');
						isBlocked = true;
					} else if ( blockexpiry ) {
						var blockexpirydate = blockexpiry.replace( /(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2,3})/, '$1-$2-$3T$4:$5:$6Z' );
						blockexpiry = new Date(blockexpirydate).toLocaleString(lang.get('dateformat'), timeoptions);
						if ( Date.parse(blockexpirydate) > Date.now() ) isBlocked = true;
					}
					var blockedby = queryuser.blockedby;
					var blockreason = queryuser.blockreason;
					var block = {
						header: lang.get('user.block.header', username, queryuser.gender).escapeFormatting(),
						text: lang.get('user.block.' + ( blockreason ? 'text' : 'noreason' ), blockedtimestamp, blockexpiry),
						by: blockedby,
						reason: blockreason
					};
					
					var pagelink = wiki.toLink(namespace + username, querystring.toTitle(), fragment, body.query.general);
					if ( msg.showEmbed() ) {
						var text = '<' + pagelink + '>';
						var embed = new MessageEmbed().setAuthor( body.query.general.sitename ).setTitle( username.escapeFormatting() ).setURL( pagelink ).addField( editcount[0], '[' + editcount[1] + '](' + wiki.toLink(contribs + username, '', '', body.query.general, true) + ')', true ).addField( group[0], group.slice(1).join(',\n'), true ).addField( gender[0], gender[1], true ).addField( registration[0], registration[1], true );
						
						if ( querypage.pageprops && querypage.pageprops.description ) {
							var description = htmlToPlain( querypage.pageprops.description );
							if ( description.length > 2000 ) description = description.substring(0, 2000) + '\u2026';
							embed.setDescription( description );
						}
						else if ( querypage.extract ) {
							var extract = extract_desc(querypage.extract);
							embed.setDescription( extract[0] );
						}
					}
					else {
						var embed = {};
						var text = '<' + pagelink + '>\n\n' + gender.join(' ') + '\n' + registration.join(' ') + '\n' + editcount.join(' ') + '\n' + group[0] + ' ' + group.slice(1).join(', ');
					}
					if ( wiki.endsWith( '.gamepedia.com/' ) ) got.get( wiki + 'api.php?action=profile&do=getPublicProfile&user_name=' + encodeURIComponent( username ) + '&format=json&cache=' + Date.now() ).then( presponse => {
						var pbody = presponse.body;
						if ( presponse.statusCode !== 200 || !pbody || pbody.error || pbody.errormsg || !pbody.profile ) {
							console.log( '- ' + presponse.statusCode + ': Error while getting the user profile: ' + ( pbody && ( pbody.error && pbody.error.info || pbody.errormsg ) ) );
						}
						else {
							if ( pbody.profile['link-discord'] ) {
								if ( pbody.profile['link-discord'].length > 50 ) pbody.profile['link-discord'] = pbody.profile['link-discord'].substring(0, 50) + '\u2026';
								if ( msg.channel.type === 'text' ) var discordmember = msg.guild.members.cache.find( member => {
									return member.user.tag === pbody.profile['link-discord'].replace( /^\s*([^@#:]{2,32}?)\s*#(\d{4,6})\s*$/, '$1#$2' );
								} );
								var discordname = [lang.get('user.info.discord'),pbody.profile['link-discord'].escapeFormatting()];
								if ( discordmember ) discordname[1] = discordmember.toString();
								
								if ( msg.showEmbed() ) embed.addField( discordname[0], discordname[1], true );
								else text += '\n' + discordname.join(' ');
							}
							if ( pbody.profile['favwiki'] ) {
								var favwiki = [lang.get('user.info.favwiki'),allSites.find( site => site.md5_key === pbody.profile['favwiki'] )];
								if ( favwiki[1] ) {
									if ( msg.showEmbed() ) embed.addField( favwiki[0], '[' + favwiki[1].wiki_display_name + '](<https://' + favwiki[1].wiki_domain + '/>)', true );
									else text += '\n' + favwiki[0] + ' <https://' + favwiki[1].wiki_domain + '/>';
								}
							}
						}
					}, error => {
						console.log( '- Error while getting the user profile: ' + error );
					} ).finally( () => {
						if ( msg.showEmbed() ) {
							if ( isBlocked ) {
								block.text = block.text.replaceSave( /\$3/g, '[' + block.by.escapeFormatting() + '](' + wiki.toLink('User:' + block.by, '', '', body.query.general, true) + ')' );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toMarkdown(wiki, body.query.general) );
								embed.addField( block.header, block.text );
							}
						}
						else {
							if ( isBlocked ) {
								block.text = block.text.replaceSave( /\$3/g, block.by.escapeFormatting() );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toPlaintext() );
								text += '\n\n**' + block.header + '**\n' + block.text;
							}
						}
						
						if ( msg.channel.type === 'text' && msg.guild.id in patreons ) {
							if ( msg.showEmbed() ) embed.addField( '\u200b', '<a:loading:641343250661113886> **' + lang.get('user.info.loading') + '**' );
							else text += '\n\n<a:loading:641343250661113886> **' + lang.get('user.info.loading') + '**';
							
							msg.sendChannel( spoiler + text + spoiler, {embed} ).then( message => global_block(lang, message, username, text, embed, wiki, spoiler, queryuser.gender) );
						}
						else msg.sendChannel( spoiler + text + spoiler, {embed} );
						
						if ( reaction ) reaction.removeEmoji();
					} );
					else if ( wiki.isFandom() ) got.get( wiki + 'wikia.php?controller=UserProfile&method=getUserData&userId=' + queryuser.userid + '&format=json&cache=' + Date.now() ).then( presponse => {
						var pbody = presponse.body;
						if ( presponse.statusCode !== 200 || !pbody || !pbody.userData || !pbody.userData.id ) console.log( '- ' + presponse.statusCode + ': Error while getting the user profile.' );
						else {
							if ( pbody.userData.posts ) {
								if ( msg.showEmbed() ) embed.spliceFields(1, 0, {
									name: lang.get('user.info.postcount'),
									value: '[' + pbody.userData.posts + '](' + wiki + 'f/u/' + queryuser.userid + ')',
									inline: true
								});
								else {
									let splittext = text.split('\n');
									splittext.splice(5, 0, lang.get('user.info.postcount') + ' ' + pbody.userData.posts);
									text = splittext.join('\n');
								}
							}
							if ( pbody.userData.discordHandle ) {
								let discord = pbody.userData.discordHandle.replace( /^\s*([^@#:]{2,32}?)\s*#(\d{4,6})\s*$/, '$1#$2' );
								if ( discord.length > 50 ) discord = discord.substring(0, 50) + '\u2026';
								if ( msg.channel.type === 'text' ) var discordmember = msg.guild.members.cache.find( member => {
									return member.user.tag.escapeFormatting() === discord;
								} );
								let discordname = [lang.get('user.info.discord'),discord];
								if ( discordmember ) discordname[1] = discordmember.toString();
								
								if ( msg.showEmbed() ) embed.addField( discordname[0], discordname[1], true );
								else text += '\n' + discordname.join(' ');
							}
							if ( msg.showEmbed() ) {
								if ( pbody.userData.avatar ) embed.setThumbnail( pbody.userData.avatar.replace( '/thumbnail/width/400/height/400', '' ) );
								if ( pbody.userData.bio && !embed.description ) {
									let bio = pbody.userData.bio.escapeFormatting();
									if ( bio.length > 2000 ) bio = bio.substring(0, 2000) + '\u2026';
									embed.setDescription( bio );
								}
							}
						}
					}, error => {
						console.log( '- Error while getting the user profile: ' + error );
					} ).finally( () => {
						if ( msg.showEmbed() ) {
							if ( isBlocked ) {
								block.text = block.text.replaceSave( /\$3/g, '[' + block.by.escapeFormatting() + '](' + wiki.toLink('User:' + block.by, '', '', body.query.general, true) + ')' );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toMarkdown(wiki, body.query.general) );
								embed.addField( block.header, block.text );
							}
						}
						else {
							if ( isBlocked ) {
								block.text = block.text.replaceSave( /\$3/g, block.by.escapeFormatting() );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toPlaintext() );
								text += '\n\n**' + block.header + '**\n' + block.text;
							}
						}
						
						if ( msg.channel.type === 'text' && msg.guild.id in patreons ) {
							if ( msg.showEmbed() ) embed.addField( '\u200b', '<a:loading:641343250661113886> **' + lang.get('user.info.loading') + '**' );
							else text += '\n\n<a:loading:641343250661113886> **' + lang.get('user.info.loading') + '**';
							
							msg.sendChannel( spoiler + text + spoiler, {embed} ).then( message => global_block(lang, message, username, text, embed, wiki, spoiler, queryuser.gender) );
						}
						else msg.sendChannel( spoiler + text + spoiler, {embed} );
						
						if ( reaction ) reaction.removeEmoji();
					} );
					else {
						if ( isBlocked ) {
							if ( msg.showEmbed() ) {
								block.text = block.text.replaceSave( /\$3/g, '[' + block.by.escapeFormatting() + '](' + wiki.toLink('User:' + block.by, '', '', body.query.general, true) + ')' );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toMarkdown(wiki, body.query.general) );
								embed.addField( block.header, block.text );
							}
							else {
								block.text = block.text.replaceSave( /\$3/g, block.by.escapeFormatting() );
								if ( block.reason ) block.text = block.text.replaceSave( /\$4/g, block.reason.toPlaintext() );
								text += '\n\n**' + block.header + '**\n' + block.text;
							}
						}
						
						msg.sendChannel( spoiler + text + spoiler, {embed} ).then( message => global_block(lang, message, username, text, embed, wiki, spoiler, queryuser.gender) );
						
						if ( reaction ) reaction.removeEmoji();
					}
				}
			}
		}, error => {
			console.log( '- Error while getting the search results: ' + error );
			msg.sendChannelError( spoiler + '<' + wiki.toLink(namespace + username, querystring.toTitle(), fragment) + '>' + spoiler );
			
			if ( reaction ) reaction.removeEmoji();
		} );
	}
}

/**
 * Turns the siteinfo logo into an URL.
 * @param {Object} arg - The siteinfo from the wiki.
 * @param {String} arg.logo - The logo from the wiki.
 * @param {String} arg.server - The server URL from the wiki.
 * @returns {String}
 */
function logoToURL({logo, server: serverURL}) {
	if ( !/^(?:https?:)?\/\//.test(logo) ) logo = serverURL + ( logo.startsWith( '/' ) ? '' : '/' ) + logo;
	return logo.replace( /^(?:https?:)?\/\//, 'https://' );
}

/**
 * Change HTML text to plain text.
 * @param {String} html - The text in HTML.
 * @returns {String}
 */
function htmlToPlain(html) {
	var text = '';
	var parser = new htmlparser.Parser( {
		ontext: (htmltext) => {
			text += htmltext.escapeFormatting();
		}
	}, {decodeEntities:true} );
	parser.write( html );
	parser.end();
	return text;
};

/**
 * Change HTML text to markdown text.
 * @param {String} html - The text in HTML.
 * @returns {String}
 */
function htmlToDiscord(html) {
	var text = '';
	var parser = new htmlparser.Parser( {
		onopentag: (tagname, attribs) => {
			switch (tagname) {
				case 'b':
					text += '**';
					break;
				case 'i':
					text += '*';
					break;
				case 's':
					text += '~~';
					break;
				case 'u':
					text += '__';
					break;
			}
		},
		ontext: (htmltext) => {
			text += htmltext.escapeFormatting();
		},
		onclosetag: (tagname) => {
			switch (tagname) {
				case 'b':
					text += '**';
					break;
				case 'i':
					text += '*';
					break;
				case 's':
					text += '~~';
					break;
				case 'u':
					text += '__';
					break;
			}
		}
	}, {decodeEntities:true} );
	parser.write( html );
	parser.end();
	return text;
};

module.exports = {
	name: 'user',
	run: gamepedia_user
};