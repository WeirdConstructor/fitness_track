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
        m.request({ method: "GET", url: "/day/" + get_day_fmt(this.date) })
         .then(function(data) {
            console.log("DATA:", data);
         })
         .catch(http_err)
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
