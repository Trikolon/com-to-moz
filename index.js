const fsPromise = require("fs").promises;
const crypto = require('crypto');
const glob = require('glob')

const COM_RULE_DIR = "../Consent-O-Matic/rules";
const FILE_OUT = "./generated-rules.json";

function convertRule(comRule) {
    // Find the rule object by looking for the first key that isn't the schema.
    let ruleKey = Object.keys(comRule).find(key => key != "$schema");

    comRule = comRule[ruleKey];
    if (!comRule) {
        throw new Error("Could not find rule key");
    }

    let presence;
    let presentMatcher;

    try {
        presentMatcher = comRule.detectors[0].presentMatcher;
        if (Array.isArray(presentMatcher)) {
            presentMatcher = presentMatcher.find(m => m.type == "css" && m.target?.selector);
        }
        presence = presentMatcher.target.selector
    } catch (error) {
        console.debug("error while getting presence selector", error, JSON.stringify(comRule, null, 2));
        throw error;
    }

    return {
        id: ruleKey,
        domains: [],
        click: {
            optIn: "",
            optOut: "",
            presence,
        }
    }
}


(async () => {
    let ruleFiles = await glob(`${COM_RULE_DIR}/*.json`);

    let promises = ruleFiles.map(async (ruleFile) => {
        console.debug("Getting rule", ruleFile);
        let ruleStr = await fsPromise.readFile(ruleFile, {
            encoding: "utf-8",
        });

        let rule = JSON.parse(ruleStr);

        return convertRule(rule);
    });


    let results = await Promise.allSettled(promises);
    let success = [];
    let failure = [];

    results.forEach(r => {
        if (r.status == "fulfilled") {
            success.push(r.value);
        } else {
            failure.push(r.reason);
        }
    });


    await fsPromise.writeFile(
        FILE_OUT,
        JSON.stringify({
            data: success,
        }, null, 2)
    );


    console.info("Done!", { successCount: success.length, failureCount: failure.length });
})();

