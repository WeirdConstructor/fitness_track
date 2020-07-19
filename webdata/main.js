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


let g_modal_item_select = null;

function input_item(cb) {
    g_modal_item_select = {
        cb: cb,
    };
}

let g_modal_value_input = null;

function input_value(name, init, cb, cancel_cb) {
    g_modal_value_input = {
        init: init,
        name: name,
        cb: cb,
        cancel_cb: cancel_cb,
    };
}


class ModalItemInput {
    view(vn) {
        if (!g_modal_item_select) {
            return m("span");
        }

        return m("div", { class: "modal is-active" }, [
            m("div", { class: "modal-background" }),
            m("div", { class: "modal-content" }, [
                m(ItemSelector, {
                    onselect: function(item) {
                        let mi = g_modal_item_select;
                        g_modal_item_select = null;

                        input_value(item.name, s100(item.amount_vals), function(amount) {
                            item = Object.assign({}, item);
                            mi.cb(item, amount * 100);
                        }, function() {
                            g_modal_item_select = mi;
                        });
                    },
                    item_provider: STATE.get_items(),
                }),
            ]),
            m("button.modal-close.is-large", { ["aria-label"]: "close", onclick: function() {
                g_modal_item_select = null;
            } }),
        ]);
    }
}

class ModalValueInput {
    view(vn) {
        if (!g_modal_value_input) {
            return m("span");
        }

        return m("div", { class: "modal is-active" }, [
            m("div", { class: "modal-background" }),
            m("div", { class: "modal-content" }, [
                m(TouchNumberInput, {
                    init: g_modal_value_input.init,
                    title: g_modal_value_input.name,
                    oncancel: function() {
                        if (g_modal_value_input.cancel_cb) {
                            g_modal_value_input.cancel_cb();
                        }
                        g_modal_value_input = null;
                    },
                    onok: function(val) {
                        g_modal_value_input.cb(val);
                        g_modal_value_input = null;
                    },
                })
            ]),
            m("button.modal-close.is-large", { ["aria-label"]: "close", onclick: function() {
                if (g_modal_value_input.cancel_cb) {
                    g_modal_value_input.cancel_cb();
                }
                g_modal_value_input = null;
            } }),
        ]);
    }
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
                                m("span", [
                                    m("span.icon", m("i.fas.fa-plus")),
                                    m("span", "water"),
                                    m("span.icon", m("i.fas.fa-tint"))])),
                            m("a.button.is-primary", {
                                     onclick: function(ev) { open_diary(); } },
                                m("span", [
                                    m("span.icon", m("i.fas.fa-plus")),
                                    m("span", "food"),
                                    m("span.icon", m("i.fas.fa-burn"))])),
                            m("a.button.is-primary", {
                                     onclick: function(ev) { open_diary(); } },
                                m("span", [
                                    m("span.icon", m("i.fas.fa-plus")),
                                    m("span", "training"),
                                    m("span.icon", m("i.fas.fa-dumbbell"))])),
                            m("a.button.is-primay", {
                                onclick: function(ev) {
                                   STATE.get_items().new_item(function(id) {
                                       // TODO: route to /item/id for editing
                                       console.log("GOT NEW ITEM:", id);
                                   });
                                } },
                                "New Item"),
                            m("a.button.is-primay", { href: "#/items" }, "Browse Items"),
                            m("a.button.is-light", { href: "#/today" }, "Today"),
                            m("a.button.is-light", {
                                     onclick: function(ev) { open_diary(1); } },
                                "Yesterday"),
                            m("a.button.is-light", {
                                     href: "#!/week/" + padl("" + get_week_fmt(), "0", 2) },
                                "Week"),
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

    make_goal(key, unit, icon, data, ratio) {
        return m("tr", [
            m("th", m("span.icon", m("i.fas." + icon))),
            m("td.has-text-right.nw", (data.goals[key] - data.current[key]) + " " + unit),
            m("td.has-text-right.nw", data.current[key] + " " + unit),
            m("td.has-text-right.nw", ratio ? ratio : ""),
            m("td.has-text-right.nw", data.current[key + "_p"] + " %"),
            m("td.has-text-right.nw", data.goals[key] + " " + unit),
        ])
    }

    view() {
        let goal_data = STATE.get_current_day().goals();
        if (goal_data == null) {
            return mk_progress();
        }

        let cfp_ratios = STATE.get_current_day().cfp_ratios();

        return m("div", [
            m("table.table.is-striped.is-fullwidth.is-size-7", [
                m("thead",
                    m("tr", [
                        m("th.has-text-right", ""),
                        m("th.has-text-right.nw", "left"),
                        m("th.has-text-right.nw", "sum"),
                        m("th.has-text-right.nw", "kcal ratio"),
                        m("th.has-text-right.nw", "goal %"),
                        m("th.has-text-right.nw", "goal"),
                    ])),
                m("tbody", [
                    this.make_goal("kcal",     "",   "fa-burn",        goal_data, goal_data.current.kcal_c),
                    this.make_goal("carbs",    "g",  "fa-bread-slice", goal_data, goal_data.current.carbs_c_p + " %"),
                    this.make_goal("fat",      "g",  "fa-cheese",      goal_data, goal_data.current.fat_c_p + " %"),
                    this.make_goal("protein",  "g",  "fa-dna",         goal_data, goal_data.current.protein_c_p + " %"),
                    this.make_goal("water_ml", "ml", "fa-tint",        goal_data),
                ]),
            ]),
            m(ItemSelector, {
                meal_view: true,
                item_provider: STATE.get_current_day(),
            }),
        ]); // "X:" + STATE.get_current_day().get_date())
    }
}

var Layout = {
    view: function(vn) {
        return m("div.#top", [
            m(NavbarView),
            m("section.section", { style: "padding-top: 0.5rem" }, [
                m(ModalView),
                m(ModalValueInput),
                m(ModalItemInput),
                m("div.columns.is-12", [
                    m("div.column.is-2"),
                    m("div.column.is-8", vn.attrs.center),
                    m("div.column.is-2"),
                ]),
            ])
        ]);
    }
};

var TouchNumberInput = {
    oninit: function(vn) {
        if (vn.attrs.init != null) {
            vn.state.num = vn.attrs.init;
        } else {
            vn.state.num = 0;
        }
    },
    view: function(vn) {
        return m("div.panel", [
            m("p.panel-heading", vn.attrs.title),
            m("div.panel-block.has-background-white", vn.state.num),
            m("div.panel-block.has-background-white",
                m("div.buttons.has-addons.is-centered", [
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num = 0; } }, "= 0"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 1; } }, "+ 1"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 5; } }, "+ 5"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 10; } }, "+ 10"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 50; } }, "+ 50"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 100; } }, "+ 100"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 500; } }, "+ 500"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num += 1000; } }, "+ 1000"),
                ])),
            m("div.panel-block.has-background-white",
                m("div.buttons.has-addons.is-centered", [
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num = 0; } }, "= 0"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 1; } }, "- 1"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 5; } }, "- 5"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 10; } }, "- 10"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 10; } }, "- 50"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 100; } }, "- 100"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 500; } }, "- 500"),
                    m("button.button.is-primary.is-outlined", {
                        onclick: function() { vn.state.num -= 1000; } }, "- 1000"),
                ])),
            m("div.panel-block.has-background-white",
                m("div.buttons.has-addons.is-centered", [
                    m("button.button.is-primary", {
                        onclick: function() { vn.attrs.onok(vn.state.num); } }, "Ok"),
                    m("button.button.is-warning", {
                        onclick: function() { vn.attrs.oncancel(); } }, "Cancel"),
                ])),
        ])
    },
};

function mk_progress() {
    return m("progress.progress.is-large.is-info", { max: 100 }, "50%");
}

function s100(d) { return Math.round(d / 100) }

class ItemView {
    view(vn) {
        if (!vn.attrs.edit) {
            return mk_progress();
        }

        let item     = vn.attrs.edit.item;
        let subitems = vn.attrs.edit.subitems;

        if (!item) {
            return mk_progress();
        }

        console.log("EDIT ITEM:", vn.attrs.edit);

        let headers = [];

        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-burn")),
             m("span",      "kcal")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-bread-slice")),
             m("span",      "carbs")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-cheese")),
             m("span",      "fat")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-dna")),
             m("span",      "protein")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-balance-scale")),
             m("span",      "portion g")])));


        let name_elem = [
            m("span", item.name),
            m("button.button.is-primary.is-pulled-right.is-small", {
                onclick: function() {
                    vn.state.is_name_edit = true;
                },
            }, "edit"),
        ];

        if (vn.state.is_name_edit) {
            name_elem = [
                m("input.is-primary[type=text]", {
                    oninput: function(e) {
                        item.name = e.target.value;
                    },
                    value: item.name
                })
            ];
        }

        let amount_cell = s100(item.amount);
        let edit_column = null;

        if (subitems && subitems.length > 0) {
            edit_column = [];
            amount_cell = s100(item.amount_vals);

        } else {
            edit_column =
                m("tr",
                    m("td.has-text-centered", m("button.button.is-primary", { onclick: function() {
                        input_value("kcal", s100(item.kcal), function(new_val) {
                            item.kcal = new_val * 100;
                        });
                    } }, "edit")),
                    m("td.has-text-centered", m("button.button.is-primary", { onclick: function() {
                        input_value("carbs", s100(item.carbs), function(new_val) {
                            item.carbs = new_val * 100;
                        });
                    } }, "edit")),
                    m("td.has-text-centered", m("button.button.is-primary", { onclick: function() {
                        input_value("fat", s100(item.fat), function(new_val) {
                            item.fat = new_val * 100;
                        });
                    } }, "edit")),
                    m("td.has-text-centered", m("button.button.is-primary", { onclick: function() {
                        input_value("protein", s100(item.protein), function(new_val) {
                            item.protein = new_val * 100;
                        });
                    } }, "edit")),
                    m("td.has-text-centered", m("button.button.is-primary", { onclick: function() {
                        input_value("protein", s100(item.amount), function(new_val) {
                            item.amount = new_val * 100;
                        });
                    } }, "edit"))
                );
        }


        return m("div.panel",
            m("div.panel-heading", name_elem),
            m("div.panel-block",
                m("div.table-container",
                    m("table.table.is-bordered",
                        m("tbody",
                            m("tr", m("th", "id"),    m("td", item.id)),
                            m("tr", m("th", "ctime"), m("td", item.ctime)),
                            m("tr", m("th", "mtime"), m("td", item.mtime)))))),
            m("div.panel-block",
                m("div.table-container",
                    m("table.table.is-bordered",
                        m("thead", headers),
                        m("tbody",
                            m("tr",
                                m("td.has-text-right", s100(item.kcal)),
                                m("td.has-text-right", s100(item.carbs)),
                                m("td.has-text-right", s100(item.fat)),
                                m("td.has-text-right", s100(item.protein)),
                                m("td.has-text-right", amount_cell)),
                            edit_column)))),
            m("div.panel-block",
                m("div.buttons.has-addons.is-centered", [
                    m("button.button.is-primary", { onclick: function() {
                        vn.attrs.onsave(vn.attrs.edit);
                        vn.state.is_name_edit = false;
                    } }, "save"),
                    m("button.button.is-primary", { onclick: function() {
                        input_item(function(item, amount) {
                            if (!vn.attrs.edit.subitems) {
                                vn.attrs.edit.subitems = [];
                            }
                            item.amount = amount;
                            item.unit   = "g";
                            vn.attrs.edit.subitems.push(item);
                            vn.attrs.onsave(vn.attrs.edit);
                        });
                    } }, "add item (g)"),
                    m("button.button.is-primary", { onclick: function() {
                        input_item(function(item, amount) {
                            if (!vn.attrs.edit.subitems) {
                                vn.attrs.edit.subitems = [];
                            }
                            item.amount = amount;
                            item.unit   = "p";
                            vn.attrs.edit.subitems.push(item);
                            vn.attrs.onsave(vn.attrs.edit);
                        });
                    } }, "add item (p)"),
                ])),
        );
    }
}

class ItemSelector {
    view(vn) {
        let item_rows = [];
        let items = vn.attrs.item_provider.items_view_order();
        if (!items) {
            return mk_progress();
        }
        let action_elem = "span.fas.fa-plus";
        if (vn.attrs.action == "remove") {
            action_elem = "span.fas.fa-minus";
        } else if (vn.attrs.action == "edit") {
            action_elem = "span.fas.fa-edit";
        }

        let meal_view = vn.attrs.meal_view;

        items.forEach(function(item) {
            let tr = [
                m("td",
                    m("button.button.is-primary", {
                        onclick: function() { vn.attrs.onselect(item); }
                    }, m(action_elem))),
                m("td", item.name),
            ];
            if (!meal_view) {
                tr.push(m("td.has-text-right.nw", s100(item.amount_vals)));
                tr.push(m("td.has-text-right.nw", s100(item.amount)));
            } else {
                tr.push(m("td.has-text-right.nw", item.ctime));
                if (item.unit == "p") {
                    tr.push(m("td.has-text-right.nw", item.amount));
                } else {
                    tr.push(m("td.has-text-right.nw", s100(item.amount) + " g"));
                }
            }
            tr.push(m("td.has-text-right.nw", [m("span", s100(item.kcal)),    m("span", " kcal")]));
            tr.push(m("td.has-text-right.nw", [m("span", s100(item.carbs)),   m("span", " g")]));
            tr.push(m("td.has-text-right.nw", [m("span", s100(item.fat)),     m("span", " g")]));
            tr.push(m("td.has-text-right.nw", [m("span", s100(item.protein)), m("span", " g")]));

            item_rows.push(m("tr", tr));
        });

        let headers = [
            m("th"),
            m("th.has-text-left", m("span",
                [m("span",      "Name")])),
        ];

        if (!meal_view) {
            headers.push(m("th.has-text-right", m("span",
                [m("span.icon", m("i.fas.fa-balance-scale")),
                 m("span",      "g")])));
            headers.push(m("th.has-text-right", m("span",
                [m("span.icon", m("i.fas.fa-balance-scale")),
                 m("span",      "g/p")])));
        } else {
            headers.push(m("th.has-text-left", m("span",
                [m("span.icon", m("i.fas.fa-clock"))])));
            headers.push(m("th.has-text-right", m("span",
                [m("span.icon", "#/g")])));
        }

        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-burn")),
             m("span",      "kcal")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-bread-slice")),
             m("span",      "carbs")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-cheese")),
             m("span",      "fat")])));
        headers.push(m("th.has-text-right", m("span",
            [m("span.icon", m("i.fas.fa-dna")),
             m("span",      "protein")])));


        return m("div.panel", [
            m("p.panel-heading", vn.attrs.title),
            m("div.panel-block.has-background-white",
                m("div.table-container",
                    m("table.table.is-striped.is-size-7", [
                        m("thead", headers),
                        m("tbody", item_rows),
                    ])))
        ]);
    }
}

STATE.load_items();

m.route(document.body, '/today', {
    '/date/:date': {
        render: function(vn) {
            return m(Layout, {
                center:
                    m(JournalDayView, { date_str: vn.attrs.date }),
            })
        },
    },
    '/items': {
        render: function() {
            return m(Layout, {
                center: m("div", [
                    m(ItemSelector, {
                        action: "edit",
                        item_provider: STATE.get_items(),
                        onselect: function(item) {
                            STATE.set_current_item_id(item.id);
                        }
                    }),
                ]),
            })
        },
    },
    '/today': {
        render: function() {
            return m(Layout, {
                center: m("div", [
                    m(ItemView, {
                        edit: STATE.get_edit_item(),
                        onsave: function(edit) {
                            STATE.save_edit_item(edit);
                        },
                    }),
                    m(TouchNumberInput, { init: 120, title: "Test" }),
                    m(ItemSelector, {
                        action: "add",
                        item_provider: STATE.get_items(),
                        onselect: function(item) {
                            STATE.set_current_item_id(item.id);
                        }
                    }),
                    m(JournalDayView, { date_str: get_day_fmt(new Date) }),
                ]),
            })
        },
    },
});
