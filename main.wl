!@import u util;
!@import a auth;

!:global auth_realm     = \ "wctor_fitness" ;
!:global local_endpoint = \ "0.0.0.0:19100" ;
!:global file_prefix    = { || "/fitness/files" };
!:global file_path      = { || "webdata" };
!:global need_auth      = { ||
    ((_1 0 16) == "/fitness/public/" &or
     (_1 0 14) == "/fitness/files") { $f } { $t }
};
!:global auth           = { a:auth[[@]] };

#!save_search = {
#    db:exec $q"DELETE FROM searches WHERE search=?" _;
#    db:exec $q"INSERT INTO searches (search) VALUES(?)" _;
#};
#
#!get_search = {
#    !r = db:exec $q"SELECT search FROM searches ORDER BY id DESC LIMIT 1";
#    r.0
#};

!:global req = {
    !(method, path, data, url, qp) = @;

    !data = block :from_req {
        !t = std:str:cat method ":" path;
        match t
            $r#GET\:\/fitness\/search\/last# => { return :from_req $["ok"]; }
            $r#GET\:\/items# => {
            }
            (m $r#GET\:\/day\/(^$+[0-9]\-$+[0-9]\-$+[0-9])#) => {
                std:displayln "GET DAY" $\.m.1;
                !day   = db:exec $q"SELECT j.* FROM journal j WHERE SUBSTR(date,1,10) = ?" $\.m.1;
                .day = day.0;
                ? day {
                    !meals = db:exec $q"SELECT jm.* FROM journal_meals jm     WHERE jm.id = ?" day.id;
                    !drink = db:exec $q"SELECT jd.* FROM journal_drink jd     WHERE jd.id = ?" day.id;
                    !train = db:exec $q"SELECT jt.* FROM journal_trainings jt WHERE jt.id = ?" day.id;
                    day.meals = meals;
                    day.drink = drink;
                    day.train = train;
                    return day;
                } {
                    return $["missing"];
                }
#                !
#                    LEFT JOIN journal_meals     jm ON j.id = jm.id
#                    LEFT JOIN journal_drink     jd ON j.id = jd.id
#                    LEFT JOIN journal_trainings jt ON j.id = jt.id
#                ";
            }
            $e $["No URL Handler!", t];
    };

    std:displayln "RET[" data "]";

    (is_err data) {
        std:displayln :ERROR " " (unwrap_err data | str);
        (is_map ~ unwrap_err data) { unwrap_err data } {
            ${
                status       = 500,
                content_type = "text/plain",
                body         = unwrap_err data,
            }
        };
    } { ${ data = data } };
};

!setup_db = {
    db:connect_sqlite "fitness.sqlite";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS sub_items (
            id          INTEGER NOT NULL,
            item_id     INTEGER,
            unit        TEXT DEFAULT 'p',
            amount      INTEGER NOT NULL DEFAULT 1,
            CONSTRAINT item_fk FOREIGN KEY (id) REFERENCES item(id)
            CONSTRAINT sub_item_fk FOREIGN KEY (item_id) REFERENCES item(id)
        );
    ";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS item (
            id          INTEGER PRIMARY KEY,
            name        TEXT,
            ctime       TEXT DEFAULT (datetime('now')),
            mtime       TEXT DEFAULT (datetime('now')),
            unit        TEXT DEFAULT 'g',
            amount      INTEGER NOT NULL DEFAULT 100,
            amount_vals INTEGER NOT NULL DEFAULT 100,
            kcal        INTEGER NOT NULL,
            carbs       INTEGER NOT NULL,
            fat         INTEGER NOT NULL,
            protein     INTEGER NOT NULL,
            deleted     INTEGER NOT NULL DEFAULT 0
        );
    ";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS journal (
            id              INTEGER PRIMARY KEY,
            date            TEXT DEFAULT (datetime('now')),
            goal_kcal       INTEGER NOT NULL,
            goal_carbs      INTEGER NOT NULL,
            goal_fat        INTEGER NOT NULL,
            goal_protein    INTEGER NOT NULL,
            goal_water_ml   INTEGER NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0
        );
    ";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS journal_meals (
            id           INTEGER NOT NULL,
            ctime        TEXT DEFAULT (datetime('now')),
            item_id      INTEGER NOT NULL,
            unit         TEXT DEFAULT 'p',
            amount       INTEGER NOT NULL DEFAULT 1,
            CONSTRAINT journal_id_fk FOREIGN KEY (id)      REFERENCES journal(id)
            CONSTRAINT item_id_fk    FOREIGN KEY (item_id) REFERENCES item(id)
        );
    ";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS journal_drink (
            id           INTEGER NOT NULL,
            amount_ml    INTEGER NOT NULL,
            ctime        TEXT DEFAULT (datetime('now')),
            CONSTRAINT journal_id_fk FOREIGN KEY (id) REFERENCES journal(id)
        );
    ";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS journal_trainings (
            id           INTEGER NOT NULL,
            comment      TEXT,
            kcal         INTEGER NOT NULL,
            ctime        TEXT DEFAULT (datetime('now')),
            CONSTRAINT journal_id_fk FOREIGN KEY (id) REFERENCES journal(id)
        );
    ";

    db:exec $q"
        CREATE TABLE IF NOT EXISTS system (
            key TEXT PRIMARY KEY,
            value TEXT
        );
    ";

    !r = unwrap ~ db:exec "SELECT value FROM system WHERE key=?" :version;
    !version = r.0.value;
    std:displayln "* db version = " version;
    (not r) {
        unwrap ~ db:exec "INSERT INTO system (key, value) VALUES(?, ?)" :version "1";
    } {
        !new_version = $&$n;

#        (version == "1") {
#            .new_version = "2";
#            unwrap ~ db:exec $q"
#                CREATE TABLE IF NOT EXISTS attachments (
#                    id INTEGER PRIMARY KEY,
#                    entry_id INTEGER,
#                    upload_time TEXT NOT NULL DEFAULT (datetime('now')),
#                    type TEXT,
#                    name TEXT,
#                    local_filename TEXT,
#                    local_thumb_filename TEXT,
#                    FOREIGN KEY (entry_id) REFERENCES entries(id)
#                );
#            ";
#        };

        (is_some $*new_version) {
            db:exec "UPDATE system SET value=? WHERE key=?" new_version :version;
            std:displayln "UPDATED DATABASE FROM " version " to " new_version;
        };
    };
};

setup_db[];
