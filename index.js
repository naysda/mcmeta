import fs from "fs";
import os from "os";
import req from "request";
import cheerio from "cheerio";

const URL = "http://wiki.vg/index.php?title=Protocol_version_numbers";

const GROUPS = {
    "april-fools": {
        // Joke releases
        "v1_rv1_pre1": [0, /^1\.rv-pre1$/i], // 2016 Trendy Update
        "snap20w14inf": [0, /^20w14∞$/i], // 2020 Ultimate Content Update
        "snap22w13obaat": [0, /^22w13oneblockatatime$/i], // 2022 One Block At A Time update
        "snap23w13ab": [0, /^23w13a_or_b$/i], // 2023 Vote update
    },

    "snapshot": {
        // for example snap13w41a
        "snap{}": [1, /^([0-9]+w[0-9]+[a-z])*$/i],
    },

    "pre-release": {
        // for example v1_7_pre or v1_7_6_pre1
        "v{}_pre{}": [2, /^([0-9]+\.[0-9]+(?:\.[0-9]+)?)-pre([0-9])*$/i],
        "v1_14_3_ct": [0, /^1\.14\.3 - combat test$/i] // pre5?
    },

    "release-candidate": {
        // for example v1_16_rc1
        "v{}_rc{}": [2, /^([0-9]+\.[0-9]+(?:\.[0-9]+)?)-rc([0-9])*$/i],
    },

    "experimental": {
        // for example v1_18_exp1
        "v{}_exp{}": [2, /^([0-9]+\.[0-9]+(?:\.[0-9]+)?)-exp([0-9])*$/i],
    },

    "release": {
        "v{}": [1, /^([0-9]+\.[0-9]+(\.[0-9]+)?)$/i],
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

    const gameVersions = [];

    let protocolVersion = 0;
    table.find("tr").each((i, _el) => {
        const el = root(_el);
        const tmp = el.find("td, th");
        const [first, second] = [tmp.eq(0), tmp.eq(1)].map((x) => x.text().trim());

        // Avoid duplicates (?? 14w29a)
        if (gameVersions.some((ver) => ver.pretty === first)) return;

        if (i === 0) {
            if (first.toLowerCase() !== "release name"
                || second.toLowerCase() !== "version number") {
                throw new Error("Invalid table header");
            }

            // continue
            return;
        }

        let group = "";
        let codename = "";
        for (const [_type, obj] of Object.entries(GROUPS)) {
            for (const [format, [groups, regex]] of Object.entries(obj)) {
                if (regex.test(first)) {
                    group = _type;
                    codename = format;
                    for (let i = 0; i < groups; i++) {
                        codename = codename.replace("{}", first.match(regex)[i + 1] || "");
                    }
                    break;
                }
            }
        }

        if (!group || !codename) throw new Error(`Unknown version type: ${first}`);

        if (second) {
            if (!second.toLowerCase().startsWith("snapshot")) {
                protocolVersion = parseInt(second);
            } else {
                // Starting from 1.16.4-pre1
                protocolVersion = parseInt(second.substring(9)) + 0x40000000;
            }
        }

        const final = codename.replaceAll(".", "_");

        gameVersions.push({
            codename: final,
            pretty: first,
            group,
            protocolVersion,
        });
    });

    // save
    fs.writeFileSync("./public/index.json", JSON.stringify(gameVersions));
});
