"use client";

import { Archive, CircleAlert, ExternalLink, Gavel, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useT } from "@/lib/i18n";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { OFFICIAL_PENALTIES_URL, OFFICIAL_RULES_URL, OFFICIAL_TCG_URL } from "./constants";

export function RulesPanel({ playerCount, completedCount }: { playerCount: number; completedCount: number }) {
  const t = useT();
  const target = playerCount ? Math.ceil(playerCount * 0.1) : 0;
  return (
    <section>
      <Tabs defaultValue="lists">
        <TabsList className="mb-5 grid h-12 w-full grid-cols-2 rounded-xl bg-[#dfe3dc] p-1 sm:max-w-xl">
          <TabsTrigger value="lists" className="h-10 font-black"><ListChecks /> {t("panels.rules.tabLists")}</TabsTrigger>
          <TabsTrigger value="game" className="h-10 font-black"><Gavel /> {t("panels.rules.tabGame")}</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border bg-[#152238] p-6 text-white shadow-sm">
          <div className="flex items-center gap-2 text-[#e0b348]"><Gavel className="size-5" /><span className="text-xs font-black tracking-[0.16em] uppercase">{t("panels.rules.quickRef")}</span></div>
          <h2 className="mt-4 text-2xl font-black">{t("panels.rules.checksTitle")}</h2>
          <ol className="mt-5 grid gap-3 text-sm leading-6 text-white/80 sm:grid-cols-2">
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.check1Title")}</strong><br />{t("panels.rules.check1Desc")}</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.check2Title")}</strong><br />{t("panels.rules.check2Desc")}</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.check3Title")}</strong><br />{t("panels.rules.check3Desc")}</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.check4Title")}</strong><br />{t("panels.rules.check4Desc")}</li>
          </ol>
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.14em] text-muted-foreground uppercase">{t("panels.rules.goalTitle")}</p>
          <div className="mt-4 flex items-baseline gap-2"><strong className="font-mono text-5xl text-primary">{completedCount}</strong><span className="font-mono text-xl text-muted-foreground">/{target}</span></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("panels.rules.goalDesc")}</p>
          <Progress value={target ? Math.min(100, Math.round((completedCount / target) * 100)) : 0} className="mt-4 h-3" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-xl font-black">{t("panels.rules.legalTitle")}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("panels.rules.legalDesc")}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">{t("panels.rules.colGrade")}</TableHead>
              <TableHead className="w-40">{t("panels.rules.colInitial")}</TableHead>
              <TableHead>{t("panels.rules.colWhen")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell><Badge className="bg-amber-100 text-amber-900">{t("panels.rules.gradeMinor")}</Badge></TableCell>
              <TableCell className="font-black">{t("panels.rules.penWarning")}</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">{t("panels.rules.minorDesc")}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><Badge className="bg-red-100 text-red-900">{t("panels.rules.gradeMajor")}</Badge></TableCell>
              <TableCell className="font-black">Game Loss</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">{t("panels.rules.majorDesc")}</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><Badge variant="destructive">{t("panels.rules.gradeSevere")}</Badge></TableCell>
              <TableCell className="font-black">{t("panels.rules.penDisq")}</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">{t("panels.rules.severeDesc")}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black"><CircleAlert className="text-amber-600" /> {t("panels.rules.fixTitle")}</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>• {t("panels.rules.fix1")}</li>
            <li>• {t("panels.rules.fix2")}</li>
            <li>• {t("panels.rules.fix3")}</li>
            <li>• {t("panels.rules.fix4")}</li>
          </ul>
        </article>
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black"><Archive className="text-primary" /> {t("panels.rules.docsTitle")}</h3>
          <div className="mt-3 grid gap-2">
            {[
              ["Tournament Rules Handbook", OFFICIAL_RULES_URL],
              ["TCG Tournament Handbook", OFFICIAL_TCG_URL],
              ["Penalty Guidelines", OFFICIAL_PENALTIES_URL],
            ].map(([label, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between rounded-xl border bg-white px-3 text-sm font-bold transition hover:border-primary hover:text-primary">
                {label}<ExternalLink className="size-4" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("panels.rules.docsNote")}</p>
        </article>
      </div>
        </TabsContent>

        <TabsContent value="game" className="space-y-5">
          <div className="rounded-3xl border bg-[#152238] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2 text-[#e0b348]"><Gavel className="size-5" /><span className="text-xs font-black tracking-[0.16em] uppercase">{t("panels.rules.gameQuickRef")}</span></div>
            <h2 className="mt-4 text-2xl font-black">{t("panels.rules.gameTitle")}</h2>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-white/80 sm:grid-cols-2 lg:grid-cols-4">
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.step1Title")}</strong><br />{t("panels.rules.step1Desc")}</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.step2Title")}</strong><br />{t("panels.rules.step2Desc")}</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.step3Title")}</strong><br />{t("panels.rules.step3Desc")}</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">{t("panels.rules.step4Title")}</strong><br />{t("panels.rules.step4Desc")}</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black">{t("panels.rules.recurringTitle")}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("panels.rules.recurringDesc")}</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-2xl border bg-card p-4 shadow-sm md:col-span-2 xl:col-span-3">
                <h3 className="font-black">{t("panels.rules.gameErrorTitle")}</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t("panels.rules.gameErrorDesc")}</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    [t("panels.rules.gradeMinor"), "Warning", t("panels.rules.gameMinor")],
                    [t("panels.rules.gradeMajor"), "Double Prize Card", t("panels.rules.gameMajor")],
                    [t("panels.rules.gradeSevereM"), "Game Loss", t("panels.rules.gameSevere")],
                  ].map(([grade, penalty, description]) => (
                    <div key={grade} className="rounded-xl border bg-muted/35 p-3">
                      <p className="text-xs font-black tracking-wide text-muted-foreground uppercase">{grade}</p>
                      <p className="mt-1 font-black text-primary">{penalty}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6"><strong>{t("panels.rules.examples")}</strong> {t("panels.rules.examplesDesc")}</p>
              </article>
              {[
                [t("panels.rules.pace"), t("panels.rules.paceFix"), t("panels.rules.paceDesc")],
                [t("panels.rules.procedure"), t("panels.rules.procedureFix"), t("panels.rules.procedureDesc")],
                [t("panels.rules.late"), t("panels.rules.lateFix"), t("panels.rules.lateDesc")],
                [t("panels.rules.conduct"), t("panels.rules.conductFix"), t("panels.rules.conductDesc")],
                ["Cheating", "Disqualification", t("panels.rules.cheatingDesc")],
              ].map(([title, penalty, detail]) => (
                <article key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm font-bold text-primary">{penalty}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black">{t("panels.rules.rulingsTitle")}</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                [t("panels.rules.r1Title"), t("panels.rules.r1Desc")],
                [t("panels.rules.r2Title"), t("panels.rules.r2Desc")],
                [t("panels.rules.r3Title"), t("panels.rules.r3Desc")],
                [t("panels.rules.r4Title"), t("panels.rules.r4Desc")],
                [t("panels.rules.r5Title"), t("panels.rules.r5Desc")],
                [t("panels.rules.r6Title"), t("panels.rules.r6Desc")],
              ].map(([title, detail]) => (
                <article key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>{t("panels.rules.importantLabel")}</strong> {t("panels.rules.importantDesc")}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
