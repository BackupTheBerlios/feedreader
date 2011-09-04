FeedReader - A RSS Feed Aggregator for Palm WebOS
Copyright (C) 2009, 2010, 2011 Timo Tegtmeier

The icons icon-play.png, icon-pause.png, web-icon.png, email-icon.png are Copyright Palm, Inc.
The script Math.uuid.js is Copyright 2009 Robert Kieffer.
The script simplehtmlparser.hs is Copyright 2004 Erik Arvidsson.

License
=======
This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 3
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.

Contributors
============
 * Milan Roubal <roubal@keyserver.cz>
 * Yannick LE NY
 * Francisco Rivas <franciscojrivash@gmail.com>
 * Vladimir Voronov <voronov@pisem.net>

Changelog
=========

Version 3.0.0 (feature release)
-------------------------------
 * support for TouchPad added

Version 2.1.4 (maintenance release)
-----------------------------------
 * improved ATOM compatibility

Version 2.1.3 (bug fix)
-----------------------
 * fixed initial database creation
 * improved link handling in FullStoryScene

Version 2.1.2 (Minor Feature Release)
-------------------------------------
 * added ability to delete storys
 * the AddFeed-Scene now saves on back gesture

Version 2.1.1 (bug fix)
-----------------------
 * fixed spanish locale

Version 2.1.0 (feature release)
-------------------------------
 * added support for Read it Later
 * improved compatibility
 * improved icons

Version 2.0.3 (maintenance release)
-----------------------------------
 * added another date/time format
 * improved "pubdate" handling
 * improved multiple link handling
 * improved ATOM support

Version 2.0.2 (bug fix)
-----------------------
 * fixed problem in french locale

Version 2.0.1 (bug fix)
-----------------------
 * fixed a localization problem

Version 2.0.0 (feature release)
-------------------------------
 * new database backend
 * greatly improved speed
 * stories can now be marked as being "starred"
 * changed the way, stories are classified as being "new"
 * refactored list formatters
 * improved transition control
 * the search function now searches the stories texts too
 * french locale (thanks to Yannick LE NY)

Version 1.3.0 (feature release)
-------------------------------
 * changes from 1.2.3
 * improved splash screen handling
 * improved handling of links in ATOM feeds
 * html can be allowed for full story view (new default)
 * Added czech locale

Version 1.2.3 (not released)
----------------------------
 * One can now send a feed's URL via E-Mail and SMS
 * One can now send a story via E-Mail and SMS
 * Fixed a problem, when dashboard it tapped while application
   is running
 * basic video podcast support
 * changed the media handling to conform webOS 1.4
 * work-around the timeout for headless apps in webOS 1.4

Version 1.2.2 (Maintenance Release)
-----------------------------------
 * Redirection from the story list to the browser works again
 * The feed importer now works with relative urls too
 * minor processing improvements

Version 1.2.1 (Minor Feature Release)
-------------------------------------
 * The core navi button pulsates when new stories arrive (under webOS 1.4)
 * Added custom a splashscreen (for webOS 1.4)
 * Optimized some routines for speed
 * The main list widgets in the are now filled dynamically
 * The story list can now optionally show only unread/new items
 * The feeds are now sorted by date
 * The all-items feed can be sorted by date
 * Notifications are now displayed using a dasboard stage

Version 1.2 (Feature Release)
-----------------------------
 * The feed contents can now be displayed using a larger font
 * The Add/Edit-Feed dialog has been changed to be a scene and is re-designed
 * It is now possible to show only captions, only summarys or both (default)
 * The CSS structure has been changed
 * The date conversion routines have been extracted into a separate class
 * The dates are no longer stored as strings
 * Basic PodCast support has been added
 * Overhauled the spooler class
 * Changed the license to GNU GPL v3
 * Feeds can be imported from websites
 * The standard support scene is now used
 * Added a scrim to every the main scenes, so user will see the scene once
   it is fully setup

Version 1.1.1 (Maintenance Release)
-----------------------------------
 * Fixed some bugs regarding list re-ordering
 * Fixed a bug concerning feed deletion
 * Fixed a bug concerning the list header icon
 * Removed some debug messages
 * Introduced a spooler class
 * Moved the codepage conversion into a seperate class

Version 1.1 (Feature Release)
-----------------------------
 * all unread stories are now aggregated into a pseudo feed
 * the full stories can now be read in FeedReader
 * the title color can now be customized
 * one can now quickly change between feeds in the story list
 * the feed list is now saved only when something has changed
 * old feed contents are no longer deleted if an error occurs
 * the network connection is checked before an update process is started
 * the update button in the story list is now correctly enabled and disabled
 * the feed update spinner works again
 * the list formatters no longer modify the model itself
 * removed some JSLint warnings

Version 1.0
-----------
 * initial Release
