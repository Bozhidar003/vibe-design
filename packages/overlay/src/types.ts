export interface ComputedDesignStyles {
  fontFamily: string
  fontSize: string
  fontWeight: string
  lineHeight: string
  letterSpacing: string
  color: string
  textAlign: string
  padding: string
  margin: string
  gap: string
  display: string
  flexDirection: string
  alignItems: string
  justifyContent: string
  backgroundColor: string
  borderRadius: string
  border: string
  boxShadow: string
  opacity: string
  width: string
  height: string
}

export interface ComponentIdentity {
  componentName: string | null
  filePath: string | null
  lineNumber: number | null
  props?: Record<string, unknown> | null
  method: 'fiber' | 'dom-heuristic' | 'unresolved'
  classNameHint?: string
  tagName?: string
  textContentHint?: string
}

export interface EnrichedContext {
  intent: {
    rawText: string
    quickAction?: string
    augmentedIntent?: string
  }

  target: {
    componentName: string | null
    filePath: string | null
    lineNumber: number | null
    isSharedComponent: boolean
    usageCount: number
    usageLocations: string[]
    rawJSX?: string
    fiberResolutionMethod: 'fiber' | 'dom-heuristic' | 'unresolved'
  }

  currentState: {
    className: string
    computedStyles: ComputedDesignStyles
    inheritedStyles: {
      fontSize?: string
      color?: string
      fontFamily?: string
      lineHeight?: string
    }
  }

  designContext: {
    relevantTokens: Array<{ name: string; value: string }>
    conventionViolations: string[]
    availableVariants?: string[]
  }

  structuralContext: {
    parentComponent: {
      name: string | null
      className: string
      computedLayout: {
        display: string
        flexDirection?: string
        alignItems?: string
        justifyContent?: string
        gap?: string
        gridTemplateColumns?: string
      }
    }
    siblings: Array<{
      componentName: string | null
      className: string
      tagName: string
    }>
    containerInfo: string
  }

  constraints: {
    tailwindOnly: boolean
    keepAccessible: boolean
    allowNewDependencies: boolean
    allowNewFiles: boolean
  }

  screenshots?: {
    elementCrop: string
    viewportWithBoundingBox: string
  }
}

export interface QuickAction {
  label: string
  prompt: string
  icon: string
}

export interface VibeStatus {
  type: 'status'
  state: 'pending' | 'working' | 'done' | 'error'
  message?: string
}
