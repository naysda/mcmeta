import fs from "fs";
import os from "os";
import req from "request";
import cheerio from "cheerio";

const URL = "http://wiki.vg/index.php?title=Protocol_version_numbers";

const TYPES = {
    "joke": {
        // Joke releases
        "v1_rv1_pre1": [0, /^1\.rv-pre1$/], // 2016 Trendy Update
        "snap_20w14inf": [0, /^20w14∞$/], // 2020 Ultimate Content Update
        "snap_22w13_obaat": [0, /^22w13oneblockatatime$/], // 2022 One Block At A Time update
    },

    "snapshot": {
        // for example snap_13w41a
        "snap_{}": [1, /^([0-9]+w[0-9]+[a-z])*$/],
    },

    "pre": {
        // for example v1_7_pre or v1_7_6_pre1
        "v{}_pre{}": [2, /^([0-9]+\.[0-9]+(?:\.[0-9]+)?)-pre([0-9])*$/],
        "v1_14_3_ct": [0, /^1\.14\.3 - combat test$/] // pre5?
    },

    "rc": {
        // for example v1_16_rc1
        "v{}_rc{}": [2, /^([0-9]+\.[0-9]+(?:\.[0-9]+)?)-rc([0-9])*$/],
    },

    "exp": {
        // for example v1_18_exp1
        "v{}_exp{}": [2, /^([0-9]+\.[0-9]+(?:\.[0-9]+)?)-exp([0-9])*$/],
    },

    "release": {
        "v{}": [1, /^([0-9]+\.[0-9]+(\.[0-9]+)?)$/],
    }
}

req.get(URL, (err, res, body) => {
    if (err) throw err;
    if (res.statusCode !== 200) throw new Error(res.statusMessage);

    const root = cheerio.load(body);

    const tableHeader = root("h2:contains('Versions after the Netty rewrite')");
    if (!tableHeader.length) throw new Error("Table header not found");

    const table = tableHeader.nextAll("table").first();
    if (!table.length) throw new Error("Table not found");

    const data = {};

    let protocolVersion = 0;
    table.find("tr").each((i, _el) => {
        const el = root(_el);
        const tmp = el.find("td, th");
        const [first, second] = [tmp.eq(0), tmp.eq(1)].map((x) => x.text().trim().toLowerCase());

        if (i === 0) {
            if (first !== "release name" || second !== "version number") {
                throw new Error("Invalid table header");
            }

            // continue
            return;
        }

        let type = "";
        let pretty = "";
        for (const [_type, obj] of Object.entries(TYPES)) {
            for (const [format, [groups, regex]] of Object.entries(obj)) {
                if (regex.test(first)) {
                    type = _type;
                    pretty = format;
                    for (let i = 0; i < groups; i++) {
                        pretty = pretty.replace("{}", first.match(regex)[i+1] || "");
                    }
                    break;
                }
            }
        }

        if (!type || !pretty) throw new Error(`Unknown version type: ${first}`);
        
        if (second) {
            if (!second.startsWith("snapshot")) {
                protocolVersion = parseInt(second);
            } else {
                // Starting from 1.16.4-pre1
                protocolVersion = parseInt(second.substring(9)) + 0x40000000;
            }
        }
        
        data[pretty.replaceAll(".", "_")] = { type, protocolVersion };
    });

    // save
    fs.writeFileSync("./public/index.json", JSON.stringify(data));
});
