import fs from 'fs'
import path from 'path'
import os from 'os'

import { execSync } from 'child_process'
interface TraceEvent {
    name: string
    ts: number
    dur: number
    pid: number
    tid: number
    ph: string
    cat: string
    args: any
}

interface GroupItem {
    milliseconds: number
    key: string
    event: TraceEvent
}

function addDurationToBEvents(
    events: TraceEvent[],
    keyFn: (event: TraceEvent) => string,
): TraceEvent[] {
    const stack: { [key: string]: TraceEvent } = {}
    const processedEvents: TraceEvent[] = []

    events.forEach((event) => {
        if (event.dur) {
            return
        }
        if (event.ph !== 'B' && event.ph !== 'E') {
            return
        }
        const key = keyFn(event)
        if (!key) {
            return
        }

        if (event.ph === 'B') {
            stack[key] = { ...event }
        } else if (event.ph === 'E') {
            const startEvent = stack[key]
            if (startEvent) {
                const duration = event.ts - startEvent.ts
                processedEvents.push({
                    ...startEvent,
                    dur: duration,
                    ph: 'X', // Change phase to 'X' to indicate it now has duration
                })
                delete stack[key]
            }
        } else {
            processedEvents.push(event)
        }
    })

    // Handle any unclosed 'B' events
    Object.values(stack).forEach((event) => {
        processedEvents.push(event)
    })

    return processedEvents
}

function groupAndFilterTopLevelEvents(
    events: TraceEvent[],
    eventName: string,
    keyFn: (event: TraceEvent) => string,
) {
    const groupedEvents = new Map<
        string,
        { milliseconds: number; key: string; event: TraceEvent }
    >()

    let filtered = events.filter((event) => event.name === eventName)

    filtered.forEach((event) => {
        const key = keyFn(event)
        if (!key) {
            return
        }

        const existingEvent = groupedEvents.get(key)

        if (
            !existingEvent ||
            (event.dur && event.dur > existingEvent.event.dur)
        ) {
            groupedEvents.set(key, {
                milliseconds: Number((event.dur / 1000).toFixed(1)),
                key,
                event,
            } as GroupItem)
        }
    })

    return Array.from(groupedEvents.values()).sort(
        (a, b) => b.milliseconds - a.milliseconds,
    )
}

function printBarGraph(
    title,
    data: { milliseconds: number; key: string }[],
    maxBars: number = 20,
) {
    if (!data.length) {
        console.log('No chart data found')
        return
    }
    const sortedData = data.slice(0, maxBars)
    const maxDuration = Math.max(...sortedData.map((d) => d.milliseconds))
    const maxBarLength = 50
    const maxKeyLength = Math.max(...sortedData.map((d) => d.key.length))

    console.log(`\n${title}:`)
    console.log(
        '=' + '='.repeat(maxKeyLength) + '===' + '='.repeat(maxBarLength) + '=',
    )

    sortedData.forEach(({ key, milliseconds }) => {
        const barLength = Math.round(
            (milliseconds / maxDuration) * maxBarLength,
        )
        const bar = '■'.repeat(barLength)
        const paddedKey = key.padEnd(maxKeyLength)
        console.log(`${paddedKey} | ${bar} ${milliseconds.toFixed(1)}ms`)
        // console.log('-' + '-'.repeat(maxKeyLength) + '---' + '-'.repeat(maxBarLength) + '-');
    })
}

async function main() {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsc-shame-'))

    try {
        const tscPath = getTscPath()
        console.log()
        console.log('Generating trace with tsc, this may take a while...')
        try {
            execSync(
                `${tscPath} --incremental false --composite false --generateTrace ${tempDir}`,
                {
                    shell: 'bash',
                    stdio: 'inherit',
                    // env: { ...process.env, folder: tempDir },
                },
            )
        } catch (e) {
            console.log()
            console.error(`tsc failed, continuing anyway with the trace`)
        }

        const trace = fs
            .readFileSync(path.join(tempDir, 'trace.json'))
            .toString()
        let data = JSON.parse(trace)

        let replaceBWithX = addDurationToBEvents(data, (event) => {
            let path = event.args?.path || event.args?.fileName
            if (!path) {
                return ''
            }
            return event.name + event.pid + event.tid + path
        })
        const checkSourceFile = groupAndFilterTopLevelEvents(
            replaceBWithX,
            'checkSourceFile',
            (event) => {
                if (!event.args) {
                    return ''
                }
                let file = event.args.path
                if (!file) {
                    return ''
                }
                let pathWIthLastNodeModule = file.match(
                    /node_modules\/(?!\.)(.*)/,
                )?.[1]
                if (pathWIthLastNodeModule) {
                    return pathWIthLastNodeModule
                }

                return path.relative(
                    process.cwd().toLowerCase(),
                    file.toLowerCase(),
                )
                return file
            },
        )

        const getPackageName = (event: TraceEvent) => {
            if (!event.args) {
                return ''
            }
            let file = event.args.fileName || event.args.path
            if (!file) {
                return ''
            }
            // extract node_modules package name, only packages that start with @, for example @remix-run/react
            const packageNameWithScope = file.match(
                /node_modules\/(@[^/]+\/[^/]+)/,
            )?.[1]
            if (packageNameWithScope) {
                return packageNameWithScope
            }
            // extract node_modules package name
            const packageName = file.match(/node_modules\/(?!\.)(.*?)\//)?.[1]
            if (!packageName) {
                return ''
            }
            return packageName
        }

        printBarGraph(
            'Top files by checkSourceFile duration',
            checkSourceFile.slice(0, 20),
        )
        const bindTimes = groupAndFilterTopLevelEvents(
            replaceBWithX,
            'bindSourceFile',
            getPackageName,
        )
        const findSourceFile = groupAndFilterTopLevelEvents(
            data,
            'findSourceFile',
            getPackageName,
        )
        const merged = mergeGroups(findSourceFile, bindTimes)
        printBarGraph(
            'Top packages by findSourceFile + bindSourceFile duration',
            merged.slice(0, 20),
        )
        // printBarGraph(
        //     'Top packages by bindSourceFile duration',
        //     bindTimes.slice(0, 20),
        // )
        console.log()
        console.log(
            `For more details on which node_modules files are causing the slowdown, refer to the tsc tracing guide:`,
        )
        console.log(
            `https://github.com/microsoft/TypeScript-wiki/blob/main/Performance-Tracing.md`,
        )
        console.log()
    } finally {
        fs.rmSync(tempDir, { recursive: true })
    }
}

function getTscPath() {
    // try resolve typescript with require from the current cwd
    try {
        const tscPath = require.resolve('typescript/package.json', {
            paths: [process.cwd()],
        })
        const binFile = path.join(path.dirname(tscPath), 'bin/tsc')
        if (fs.existsSync(binFile)) {
            console.log(
                `Using tsc from ${path.relative(process.cwd(), binFile)}`,
            )
            return binFile
        }
    } catch (e) {
        return 'tsc'
    }
}

function mergeGroups(events: GroupItem[], bindTimes: GroupItem[]) {
    const merged = new Map<string, GroupItem>()
    events.forEach((event) => {
        const existingEvent = merged.get(event.key)
        if (!existingEvent) {
            merged.set(event.key, event)
        } else {
            merged.set(event.key, {
                milliseconds: existingEvent.milliseconds + event.milliseconds,
                key: event.key,
                event: event.event,
            })
        }
    })
    bindTimes.forEach((event) => {
        const existingEvent = merged.get(event.key)
        if (!existingEvent) {
            merged.set(event.key, event)
        } else {
            merged.set(event.key, {
                milliseconds: existingEvent.milliseconds + event.milliseconds,
                key: event.key,
                event: event.event,
            })
        }
    })

    return Array.from(merged.values())
}

main()
