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

function groupAndFilterTopLevelEvents(
    events: TraceEvent[],
    keyFn: (event: TraceEvent) => string,
) {
    const groupedEvents = new Map<
        string,
        { milliseconds: number; key: string; event: TraceEvent }
    >()

    events
        .filter((event) => event.name === 'findSourceFile')
        .forEach((event) => {
            const key = keyFn(event)
            if (!key) {
                return
            }
            const existingEvent = groupedEvents.get(key)

            if (!existingEvent || event.dur > existingEvent.event.dur) {
                groupedEvents.set(key, {
                    milliseconds: Number((event.dur / 1000).toFixed(1)),
                    key,
                    event,
                })
            }
        })

    return Array.from(groupedEvents.values()).sort(
        (a, b) => b.milliseconds - a.milliseconds,
    )
}

function printBarGraph(
    data: { milliseconds: number; key: string }[],
    maxBars: number = 20,
) {
    const sortedData = data.slice(0, maxBars)
    const maxDuration = Math.max(...sortedData.map((d) => d.milliseconds))
    const maxBarLength = 50
    const maxKeyLength = Math.max(...sortedData.map((d) => d.key.length))

    console.log('\nTop packages by findSourceFile duration:')
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
        const result = groupAndFilterTopLevelEvents(
            JSON.parse(trace),
            (event) => {
                if (!event.args) {
                    return ''
                }
                let file = event.args.fileName
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
                const packageName = file.match(
                    /node_modules\/(?!\.)(.*?)\//,
                )?.[1]
                if (!packageName) {
                    return ''
                }
                return packageName
            },
        )

        printBarGraph(result.slice(0, 20))
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

main()
