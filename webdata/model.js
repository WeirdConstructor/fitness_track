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
                self.data = null;
            } else {
                self.data = data;
            }
            console.log("DATA:", data);
         })
         .catch(http_err)
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
            kcal_p:     Math.round((sum_kcal     ) / result.goals.kcal),
            carbs_p:    Math.round((sum_carbs    ) / result.goals.carbs),
            fat_p:      Math.round((sum_fat      ) / result.goals.fat),
            protein_p:  Math.round((sum_protein  ) / result.goals.protein),
            water_ml_p: Math.round((sum_water_ml * 100) / result.goals.water_ml),
            kcal:       Math.round(sum_kcal     / 100),
            carbs:      Math.round(sum_carbs    / 100),
            fat:        Math.round(sum_fat      / 100),
            protein:    Math.round(sum_protein  / 100),
            water_ml:   Math.round(sum_water_ml),
        };
        return result;
    }

    get_date() { return this.date }
}

class State {
    load_current_day(date_str) {
        this.current = new JournalDay();
        this.current.init(date_str);
        this.current.load();
    }

    get_current_day() { return this.current }
}
