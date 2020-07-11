let DATE_RE = /^(\d\d\d\d)-(\d\d)-(\d\d)$/;

function get_day_fmt(d) {
    return (
                padl("" + (d.getYear() + 1900),"0", 4)
        + "-" + padl("" + (d.getMonth() + 1),  "0", 2)
        + "-" + padl("" + (d.getDate()),       "0", 2));
}

function get_day(offset) {
    let d = new Date();
    if ((typeof offset) == "object")
        d = offset;
    else if (offset != null) {
        d.setDate(d.getDate() + offset);
    }
    return get_day_fmt(d);
}


function parse_date(date_str) {
    let r = date_str.match(DATE_RE);
    if (r) {
        return new Date(
            parseInt(r[1]),
            parseInt(r[2]) - 1,
            parseInt(r[3]),
        );
    } else {
        return null;
    }
}

function http_err(e) {
    // TODO: Route error to modal. Somehow pass that to JournalDay?!
    console.log("HTTP ERROR: " + e.message);
}

class JournalDay {
    init(date_str) {
        this.date = parse_date(date_str);
    }

    load() {
        let self = this;
        m.request({ method: "GET", url: "/day/" + get_day_fmt(this.date) })
         .then(function(data) {
            if (data[0] == "missing") {
                self.data = {
                };
            } else {
                self.data = data;
            }
            self.annotate_meals();
            console.log("DATA:", data);
         })
         .catch(http_err)
    }

    annotate_meals() {
        if (this.data == null) {
            return;
        }
        let items = STATE.get_items();
        this.data.meals.forEach(function(meal) {
            console.log("ANNOT MEAL:", meal);
            meal.name = items.item_id_to_name(meal.item_id);
        });
    }

    items_view_order() {
        if (this.data == null) {
            return null;
        }
        return this.data.meals
    }

    cfp_ratios() {
        let d = this.data;
        return {
            kcal:    d.kcal_calc,
            carbs:   Math.round((d.carbs   * 4.1) / 100),
            fat:     Math.round((d.fat     * 9.3) / 100),
            protein: Math.round((d.protein * 4.1) / 100),
        }
    }

    goals() {
        if (this.data == null) {
            return null;
        }
        let sum_water_ml = 0;
        let sum_kcal     = 0;
        let sum_carbs    = 0;
        let sum_fat      = 0;
        let sum_protein  = 0;

        this.data.drink.forEach(drink => sum_water_ml += drink.amount_ml);
        this.data.meals.forEach(function (meal) {
            sum_kcal    += meal.kcal;
            sum_carbs   += meal.carbs;
            sum_fat     += meal.fat;
            sum_protein += meal.protein;
        });

        let sum_kcal_c = sum_carbs * 4.1 + sum_fat * 9.3 + sum_protein * 4.1;

        let result = {
            goals: {
                kcal:     Math.round(this.data.goal_kcal    / 100),
                carbs:    Math.round(this.data.goal_carbs   / 100),
                fat:      Math.round(this.data.goal_fat     / 100),
                protein:  Math.round(this.data.goal_protein / 100),
                water_ml: this.data.goal_water_ml,
            },
        };
        result.current = {
            kcal_p:         Math.round((sum_kcal     ) / result.goals.kcal),
            carbs_p:        Math.round((sum_carbs    ) / result.goals.carbs),
            fat_p:          Math.round((sum_fat      ) / result.goals.fat),

            protein_c_p:    Math.round((sum_protein * 4.1 * 100) / sum_kcal_c),
            carbs_c_p:      Math.round((sum_carbs   * 4.1 * 100) / sum_kcal_c),
            fat_c_p:        Math.round((sum_fat     * 9.3 * 100) / sum_kcal_c),

            protein_p:      Math.round((sum_protein  ) / result.goals.protein),
            water_ml_p:     Math.round((sum_water_ml * 100) / result.goals.water_ml),
            kcal:           Math.round(sum_kcal     / 100),
            kcal_c:         Math.round(sum_kcal_c   / 100),
            carbs:          Math.round(sum_carbs    / 100),
            fat:            Math.round(sum_fat      / 100),
            protein:        Math.round(sum_protein  / 100),
            water_ml:       Math.round(sum_water_ml),
        };
        return result;
    }

    get_date() { return this.date }
}

class Items {
    load() {
        let self = this;
        m.request({ method: "GET", url: "/items/last_recently_used" })
         .then(function(data) {
            self.lru = new Map;
            let i = 0;
            data.forEach(function(id) {
                self.lru[id] = data.length - i;
                i++;
            });
         })
         .catch(http_err)

        m.request({ method: "GET", url: "/items" })
         .then(function(data) {
            self.items     = new Map(Object.entries(data[0]));
            self.sub_items = new Map(Object.entries(data[1]));
         })
         .catch(http_err)
    }

    item_by_id(id) {
        if (this.items && this.items.get("" + id)) {
            return this.items.get("" + id);
        } else {
            return null;
        }
    }

    sub_items_by_id(id) {
        if (this.items && this.sub_items.get("" + id)) {
            return this.sub_items.get("" + id);
        } else {
            return null;
        }
    }

    item_id_to_name(id) {
        let item = this.item_by_id(id);
        if (item) { return item.name; }
        else      { return "?"; }
    }

    items_view_order() {
        let self = this;
        if (!self.lru || !self.items) {
            return null;
        }

        let lru_items = [];
        self.items.forEach(function(item) {
            lru_items.push(item);
        });
        lru_items.sort(function(a, b) { self.lru[b.id] - self.lru[a.id] });
        return lru_items;
    }
}

class State {
    load_current_day(date_str) {
        this.current = new JournalDay();
        this.current.init(date_str);
        this.current.load();

    }

    load_items() {
        this.items = new Items();
        this.items.load()
    }

    set_current_item_id(id) {
        this.selected_item_id = id;
    }

    get_edit_item() {
        if (this.selected_item_id == null || this.items == null) {
            return null;
        }

        if (this.current_edit && this.current_edit.item.id == this.selected_item_id) {
            return this.current_edit;
        } else {
            this.current_edit = null;
        }

        let item     = this.items.item_by_id(this.selected_item_id);
        let subitems = this.items.sub_items_by_id(this.selected_item_id);

        if (!item) {
            return null;
        }

        if (subitems) {
            subitems = subitems.slice(0);
        }

        this.current_edit = {
            item:     Object.assign({}, item),
            subitems: subitems,
        };

        return this.current_edit;
    }


    save_edit_item(edit) {
        console.log("SAVE ITEM:", edit);
    }

    get_current_item() {
        if (this.selected_item_id == null) {
            return null;
        }

        return this.items[this.selected_item_id];
    }

    get_items() { return this.items }

    get_current_day() { return this.current }
}
