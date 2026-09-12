# All implemented skill catalog
Version: UDL-066-catalog-v1

CANON_RECEIPT version=shared-canon-v1.1 base=9515f9bed9536dc2c44b71817129abb9c86ef24f public_base=a1a9b1c830eceb98464b107f2442deacaf765505 request=UDL-20260912-066 specs=docs/SHARED_CANON.md@codex/dev-brain-current-20260910,docs/SKILL_CATALOG_20260912.md tests=tests/standard-online-skill-registry.test.cjs,tests/standard-skill-catalog.test.cjs,tests/standard-online-browser.test.cjs worktree=.codex-worktrees/skill-catalog-20260912

Source: designated Astra userbbb21b41-147b-4869-810f-ada7f33bb3f7 / design544402ae-d429-4a0e-a928-1877b7940247, verifiedv13 UI_CATALOG_SKILL_CUTIN_HANDOFF.md. User wants compact all-implemented-skills study, including unowned and small owned counts. Two columns is the selected AI layout, not a claimed user numeric instruction.

## Catalog contract
The exact authoritative set is STANDARD_SKILLS entries with standardEngineImplemented=true and eitherstandardUiEnabled oralphaUiEnabled, a known usageCategory and valid rarity. Display grouping uses usageCategory, while actual usage timing comes from definition.timing; legalRecolor is categoryexperimental but usageCategorycolor and timingWORK. Generated public metadata carries these existing fields and gachaEnabled; no copied ID list or new server feature. Currentset21:19normal,2experimental(colorBonusRefill/legalRecolor). Both experiments are explained as requiring their corresponding lab/experimental rules, not ordinary gacha or automatically available in today's normalmatch.

Initialview includesall21 evenwithout a profile. Fourcategorysections(color/area/disrupt/lab), no collapsed default/filter gate. Normalmobile390px uses2columns, widerlayouts addcolumns. Eachnativebuttonhas name,rarity andsmall×N; no repeatedcategorylabel. Unowned×0 staysreadable andclickable. No inventory grant or profile creation is needed merely to study. Everypublicdescription remains available in the existing dialog, withtiming andactualgacha/lab scope. Stablecategory/rarity/IDorder; synchronizedcountupdates reusebuttons and preservefocus/modalopener.

Catalogbuttonactions onlyopenexistingdetails; no use/equip/sell/unprotect/grant/consume. Existingcard-sale/exactretry/protection/lastcopy rules, nextsix-cardloadout, in-match3x2hand, rolepalette, quiz/rewards and065cutin remain unchanged. No hiddenopponent data. Names/descriptionsuse textnodes, notHTML.

## Tests and publication
Generatedmetadata exactagainstregistry; a localfocusedprojection test excludesunimplemented/debug-only records andprovesstable ordering. Browser: all21exactuniqueIDs/4sections; freshprofile-freeview/unownedlabdetails; countupdate/focusreuse; nativeEnter/Space/Escape; everydetail;390/768/1280 plus enlargedtext/longname/count; nooverflow and>=44pxtargets; read-onlycatalog writes0; existinggacha/cardsale/hand/cutin regression.
Newapp40,generatedregistry20260912-2 andcatalogCSS1 markers. Buildregistrythroughofficialgenerator only; local/Edgeengine bundlesunchanged.
Localparent9515 is the unpublic precedingflatUI candidate. 065 remainsfirst, thenflatUI; reconcilefreshmain/ancestrybeforefixing this releaseSHA. ExactAstra andWindowsrequired; main/Pages/DB/Edge/liveNOT_RUN by this specification. Pages_only DB[] Edge[]; no CPU/art/newskills/economy or schema changes.
