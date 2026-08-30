import Cocoa
import Foundation

// Fn key modifier flag
let kFnKeyMask: UInt64 = 0x00800000  // kCGEventFlagMaskSecondaryFn / NX_SECONDARYFNMASK

var fnIsDown = false

func startMonitoring() {
    // Create event tap for flagsChanged events (modifier key changes)
    let eventMask = (1 << CGEventType.flagsChanged.rawValue)

    guard let tap = CGEvent.tapCreate(
        tap: .cgSessionEventTap,
        place: .headInsertEventTap,
        options: .defaultTap,
        eventsOfInterest: CGEventMask(eventMask),
        callback: { (proxy, type, event, refcon) -> Unmanaged<CGEvent>? in
            if type == .flagsChanged {
                let flags = event.flags.rawValue
                let fnDown = (flags & kFnKeyMask) != 0

                if fnDown && !fnIsDown {
                    fnIsDown = true
                    print("{\"event\":\"fn-down\"}")
                    fflush(stdout)
                } else if !fnDown && fnIsDown {
                    fnIsDown = false
                    print("{\"event\":\"fn-up\"}")
                    fflush(stdout)
                }
            }
            return Unmanaged.passRetained(event)
        },
        userInfo: nil
    ) else {
        // If tap creation fails, user likely needs to grant Accessibility permission
        print("{\"event\":\"error\",\"message\":\"accessibility_permission_required\"}")
        fflush(stdout)
        exit(1)
    }

    let runLoopSource = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, tap, 0)
    CFRunLoopAddSource(CFRunLoopGetCurrent(), runLoopSource, .commonModes)
    CGEvent.tapEnable(tap: tap, enable: true)

    print("{\"event\":\"ready\"}")
    fflush(stdout)

    CFRunLoopRun()
}

// Handle SIGTERM gracefully (when Electron quits)
signal(SIGTERM) { _ in
    print("{\"event\":\"shutdown\"}")
    fflush(stdout)
    exit(0)
}

startMonitoring()
