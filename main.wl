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
            $r#GET\:/fitness/search/last# { return :from_req $["ok"]; }
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
        CREATE TABLE IF NOT EXISTS item (
            id      INTEGER PRIMARY KEY,
            parent  INTEGER,
            name    TEXT,
            ctime   TEXT DEFAULT (datetime('now')),
            mtime   TEXT DEFAULT (datetime('now')),
            unit    TEXT DEFAULT 'g',
            dim     INTEGER NOT NULL DEFAULT 100,
            kcal    INTEGER NOT NULL,
            carbs   INTEGER NOT NULL,
            fat     INTEGER NOT NULL,
            protein INTEGER NOT NULL,
            deleted INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT parent_fk FOREIGN KEY (parent) REFERENCES item(id)
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
