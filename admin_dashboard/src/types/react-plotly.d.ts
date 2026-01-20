declare module 'react-plotly.js' {
    import { Component } from 'react'
    import { PlotParams } from 'plotly.js'

    export interface PlotProps extends Partial<PlotParams> {
        data: Partial<Plotly.PlotData>[]
        layout?: Partial<Plotly.Layout>
        config?: Partial<Plotly.Config>
        frames?: Partial<Plotly.Frame>[]
        style?: React.CSSProperties
        className?: string
        useResizeHandler?: boolean
        onInitialized?: (figure: Readonly<Plotly.Figure>, graphDiv: Readonly<HTMLElement>) => void
        onUpdate?: (figure: Readonly<Plotly.Figure>, graphDiv: Readonly<HTMLElement>) => void
        onPurge?: (figure: Readonly<Plotly.Figure>, graphDiv: Readonly<HTMLElement>) => void
        onError?: (err: Readonly<Error>) => void
        divId?: string
        revision?: number
        onClickAnnotation?: (event: Readonly<Plotly.ClickAnnotationEvent>) => void
        onRelayout?: (event: Readonly<Plotly.PlotRelayoutEvent>) => void
        onRestyle?: (event: Readonly<Plotly.PlotRestyleEvent>) => void
        onRedraw?: () => void
        onSelected?: (event: Readonly<Plotly.PlotSelectionEvent>) => void
        onSelecting?: (event: Readonly<Plotly.PlotSelectionEvent>) => void
        onDeselect?: () => void
        onHover?: (event: Readonly<Plotly.PlotMouseEvent>) => void
        onUnhover?: (event: Readonly<Plotly.PlotMouseEvent>) => void
        onClick?: (event: Readonly<Plotly.PlotMouseEvent>) => void
        onDoubleClick?: () => void
        onAnimated?: () => void
        onAnimatingFrame?: (event: Readonly<Plotly.FrameAnimationEvent>) => void
        onAnimationInterrupted?: () => void
        onAutoSize?: () => void
        onBeforeExport?: () => void
        onAfterExport?: () => void
        onAfterPlot?: () => void
        onButtonClicked?: (event: Readonly<Plotly.ButtonClickEvent>) => void
        onLegendClick?: (event: Readonly<Plotly.LegendClickEvent>) => boolean
        onLegendDoubleClick?: (event: Readonly<Plotly.LegendClickEvent>) => boolean
        onSliderChange?: (event: Readonly<Plotly.SliderChangeEvent>) => void
        onSliderEnd?: (event: Readonly<Plotly.SliderEndEvent>) => void
        onSliderStart?: (event: Readonly<Plotly.SliderStartEvent>) => void
        onSunburstClick?: (event: Readonly<Plotly.SunburstClickEvent>) => void
        onTransitioning?: () => void
        onTransitionInterrupted?: () => void
        onWebGlContextLost?: () => void
    }

    export default class Plot extends Component<PlotProps> { }
}
