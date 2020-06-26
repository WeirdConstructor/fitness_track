"use strict";

// This script is released to the public domain and may be used, modified and
// distributed without restrictions. Attribution not necessary but appreciated.
// Source: https://weeknumber.net/how-to/javascript

// Returns the ISO week of the date.
Date.prototype.getWeek = function() {
  var date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  // Thursday in current week decides the year.
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  // January 4 is always in week 1.
  var week1 = new Date(date.getFullYear(), 0, 4);
  // Adjust to Thursday in week 1 and count number of weeks from date to week1.
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000
                        - 3 + (week1.getDay() + 6) % 7) / 7);
}

// Returns the four-digit year corresponding to the ISO week of the date.
Date.prototype.getWeekYear = function() {
  var date = new Date(this.getTime());
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  return date.getFullYear();
}


HTMLTextAreaElement.prototype.withCaretDo = function (cb) {
  if (this.selectionStart || this.selectionStart === 0) {
    // Others
    var startPos = this.selectionStart;
    var endPos = this.selectionEnd;
    let len = cb(startPos, endPos);
    this.selectionStart = startPos + len;
    this.selectionEnd = startPos + len;
  }
};

HTMLTextAreaElement.prototype.insertAtCaret = function (text, removeLeft) {
  text = text || '';
  if (document.selection) {
    // IE
    this.focus();
    var sel = document.selection.createRange();
    sel.text = text;
  } else if (this.selectionStart || this.selectionStart === 0) {
    // Others
    var startPos = this.selectionStart;
    if (removeLeft) {
        startPos += removeLeft;
    }
    var endPos = this.selectionEnd;
    this.value = this.value.substring(0, startPos) +
      text +
      this.value.substring(endPos, this.value.length);
    this.selectionStart = startPos + text.length;
    this.selectionEnd = startPos + text.length;
  } else {
    this.value += text;
  }
};

///
/// Setup marked.js renderer
///

const renderer = new marked.Renderer();

var listitem_rendered_entry;
var listitem_checkbox_index;

function before_calling_marked_with_entry(entry) {
    listitem_checkbox_index = 0;
    listitem_rendered_entry = entry;
}

renderer.checkbox = function(checked) {
    let value = checked ? "checked=\"1\"" : "";
    let idx = listitem_checkbox_index;
    listitem_checkbox_index = listitem_checkbox_index + 1;
    return ("<input checkidx=\"" + idx + "\" entry_id=\""
        + listitem_rendered_entry.id()
        + "\" style=\"margin-right: 0.5rem\" type=\"checkbox\" "
        + value + " oninput=\"checkbox_input(this)\">");
}

renderer.link = function(href, title, text) {
    let m = href.match(/^ent:(\d+)$/);
    if (m) {
        return "<a href=\"#!/entry/" + m[1] + "\" alt=\"entry " + m[1] + "\">[entry " + m[1]  + "]</a>";
    } else {
        m = href.match(/^attach:(\d+)_tb_(.*)$/);
        if (m) {
            return (
                "<a href=\"/fitness/files/attachments/" + m[1] + "_" + m[2] + "\">"
                + "<img src=\"/fitness/files/attachments/" + m[1] + "_tb_" + m[2] + "\">"
                + "</a>");
        } else {
            return "<a href=\"" + href + "\" alt=\"" + title + "\">" + text + "</a>";
        }
    }

};

renderer.listitem = function(text, task, checked) {
    if (task) {
        return (
            "<li style=\"list-style: none\"><label class=\"checkbox\">" 
            + text + "</label></li>");
    } else {
        return "<li>" + text + "</li>";
    }
}

const markedOptions = { renderer: renderer, }

var root = document.body;

var c = 0;

function jurl(path) {
    return "/fitness" + path
}

var recent_entries = null;
var current_entry_id = null;
var enable_entry_edit = false;
var new_entry_tags = null;
var modal = null;

function http_err(e) {
    modal = {};
    modal.cb = function() { };
    modal.text = "HTTP ERROR: " + e.message;
}

window.checkbox_input = function(e, v) {
    let entry_id = parseInt(e.attributes.getNamedItem("entry_id").nodeValue);
    if (!entry_id || !(entry_id > 0))
        return;
    let check_idx = parseInt(e.attributes.getNamedItem("checkidx").nodeValue);
    if (!entry_id || !(entry_id > 0))
        return;
    let entry = get_entry_by_id(entry_id);
    entry.set_checkbox(check_idx, e.parentElement.innerText, !!e.checked);
    m.redraw();
};

function padl(s, c, l) {
    while (s.length < l) { s = c + s; } 
    return s
}

function get_recent_valid_entry_id() {
    if (recent_entries && recent_entries.length > 0) {
        let re = recent_entries.filter(e => !e.deleted);
        if (re[0]) {
            return re[0].id;
        }
    }
    return null;
}

function goto_entry_and_edit(id) {
    goto_entry(id);
    enable_entry_edit = true;
}

function goto_entry(id) {
    m.route.set("/entry/:id", { id: id });
    let te = document.getElementById("top");
    if (te) te.scrollIntoView();
}

function get_recent_entries() {
    m.request({ method: "GET", url: jurl("/search/entries/recent") }).then(function(data) {
        if (data == null) { data = []; }
        recent_entries = data;

        console.log("RECENT ENTREIS");
        if (recent_entries.length > 0 && current_entry_id == null) {
            goto_entry(get_recent_valid_entry_id());
        }
    }).catch(http_err);
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}


function open_diary(offset) {
    search(get_day(offset), function(ents) {
        if (ents && ents.length > 0) {
            ents.map(function(e) { load_cache(e.id, e) });
            goto_entry(ents[0].id);
        } else {
            new_entry(function(entry_id) {
                new_entry_tags = [entry_id, get_day(offset) + ", timelog, diary"];
            });
        }
    });
}

function new_entry(cb) {
    m.request({
        method: "POST",
        url: jurl("/data/entries"),
        body: { tags: "new", body: "" }
    }).then(function(data) {
        get_recent_entries();
        goto_entry_and_edit(data[0].new_entry_id);
        if (cb) cb(data[0].new_entry_id);
    }).catch(http_err);
}

var entries = {};
function load_cache(id, e) {
    id = "" + id;
    if (e) {
        entries[id] = new Entry(id, e);
    } else {
        entries[id] = new Entry(id);
    }
}

function get_entry_by_id(id) {
    if (!id) return null;
    id = "" + id;

    if (entries[id]) {

    } else if (recent_entries) {
        recent_entries.map(function(e) {
            if (e.id == id) {
                load_cache(id, e);
            }
        });
        if (!entries[id]) {
            load_cache(id);
        }
    } else {
        load_cache(id);
    }

    return entries[id];
}

function get_timestamp() {
    let d = new Date();
    return (
                padl("" + (d.getYear() + 1900),"0", 4)
        + "-" + padl("" + (d.getMonth() + 1),  "0", 2)
        + "-" + padl("" + (d.getDate()),       "0", 2)
        + " " + padl("" + (d.getHours()),      "0", 2)
        + ":" + padl("" + (d.getMinutes()),    "0", 2)
        + ":" + padl("" + (d.getSeconds()),    "0", 2));
}

function m_icon_btn(icon_class, cb) {
    return m("a", { class: "card-header-icon",
                    style: "padding: 0.5rem",
                    href: "#!",
                    ["aria-label"]: "more options",
                    onclick: function(ev) { ev.preventDefault(); cb(ev) } },
        m("span", { class: "icon" },
            m("i", { class: icon_class, ["aria-hidden"]: "true" })));
}

function get_week_fmt(offs, wkd) {
    if (offs == null) offs = 0;
    let week_date = new Date();
    if (wkd) week_date = wkd;
    if ((typeof offs) == "object") {
        week_date = offs;
        offs = 0;
    }

    week_date.setDate(week_date.getDate() + (offs * 7));
    let out = (
        padl("" + (week_date.getWeekYear()), "0", 4)
        + "-kw"   + padl("" + week_date.getWeek(), "0", 2)
    );
    return out;
}

function get_week_offs_fmt(week_str, offs) {
    let kwmatch = week_str.match(/^(\d+)-kw(\d+)$/);
    if (!kwmatch) return null;

    let d = date_for_week(
        parseInt(kwmatch[1]),
        parseInt(kwmatch[2]));
    return get_week_fmt(offs, d);
}

class ModalView {
    view(vn) {
        if (modal) {
            return m("div", { class: "modal is-active" }, [
                m("div", { class: "modal-background" }),
                m("div", { class: "modal-content" }, [
                    m("div", { class: "box content" }, [
                        m("div", modal.text),
                        m("div", { class: "columns" }, [
                            m("div", { class: "column" },
                                m("button", { class: "button is-fullwidth is-danger",
                                              onclick: function() { modal.cb(); modal = null; } }, "Yes")),
                            m("div", { class: "column" },
                                m("button", { class: "button is-fullwidth is-success",
                                              onclick: function() { modal = null; } }, "Cancel")),
                        ])
                    ])
                ])
            ]);
        } else {
            return m("div");
        }
    }
};

class ClipboardText {
    view(vn) {
        return m("div", [
            m("input", { type: "text",
                         style: "width: 3rem;",
                         id: "clip_text",
                         class: "input",
                         value: vn.attrs.text }),
            m("button", { type: "text", class: "is-primary button",
                          onclick: function(e) {
                            let n = e.target.parentNode.children[0];
                            n.select();
                            n.setSelectionRange(0, 99999);
                            document.execCommand("copy");
                            vn.attrs.done();
                          } }, "Copy"),
        ]);
    }
};

function date_for_week(year, week) {
    let d = new Date(year, 0, 1);
    d.setDate(d.getDate() + (week - 1) * 7);
    d.setDate(d.getDate() - (d.getDay() - 1));
    return d;
}

let WEEK_DAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

class NavbarView {
    view(vn) {
        let active = "";
        if (vn.state.menu_active) {
            active = " is-active";
        }

        return m("nav.navbar.is-info.is-hidden-print", {
                          role: "navigation",
                          ["aria-label"]: "main navigation" }, [
            m("div.navbar-brand",
                m("a.navbar-burger.burger" + active, {
                         role: "button",
                         onclick: function() {
                            vn.state.menu_active = !vn.state.menu_active;
                         },
                         ["aria-label"]: "menu",
                         ["aria-expanded"]: "false",
                         ["data-target"]: "navbarBasicExample" }, [
                    m("span", { ["aria-hidden"]: "true" }),
                    m("span", { ["aria-hidden"]: "true" }),
                    m("span", { ["aria-hidden"]: "true" })
                ])),
            m("div.navbar-menu" + active + ".#navbarBasicExample", [
                m("div.navbar-start", [
                    m("div.navbar-item",
                        m("div.buttons", [
                            m("a.button.is-primary", {
                                onclick: function(ev) { new_entry(); } },
                                "New"),
                            m("a.button.is-light", {
                                     onclick: function(ev) { open_diary(); } },
                                "Diary"),
                            m("a.button.is-light", {
                                     onclick: function(ev) { open_diary(1); } },
                                "Diary+1"),
                            m("a.button.is-light", {
                                     href: "#!/week/" + padl("" + get_week_fmt(), "0", 2) },
                                "Week"),
                            m("a.button.is-light", { 
                                     href: "#!/week/" + padl("" + get_week_fmt(-1), "0", 2) },
                                "Last Week"),
                            m("a.button.is-link", { 
                                     onclick: function(ev) {
                                        document.getElementById("search").scrollIntoView();
                                     } },
                                "Search"),
                        ]))
                ]),
                m("div.navbar-end", [ ]),
            ]),
        ])
    }
}

let STATE = new State();

class JournalDayView {
    oninit(vn) {
        STATE.load_current_day(vn.attrs.date_str);
    }
    view() {
        return m("div", "X:" + STATE.get_current_day().get_date())
    }
}

var Layout = {
    view: function(vn) {
        return m("div.#top", [
            m(NavbarView),
            m("section.section", { style: "padding-top: 0.5rem" }, [
                m(ModalView),
                m("div.columns.is-12", [
                    m("div.column.is-2"),
                    m("div.column.is-8", vn.attrs.center),
                    m("div.column.is-2"),
                ]),
            ])
        ]);
    }
};

m.route(document.body, '/date', {
    '/date': {
        render: function() {
            return m(Layout, {
                center:
                    m(JournalDayView, { date_str: get_day_fmt(new Date) }),
            })
        },
    },
});
