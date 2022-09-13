import { useEffect } from 'react'
import { createPathComponent, LeafletContextInterface } from '@react-leaflet/core'

import L, { LeafletMouseEventHandlerFn } from 'leaflet';

type ClusterType = Record<string, any>

type ClusterEvents = {
  onClick?: LeafletMouseEventHandlerFn
  onDblClick?: LeafletMouseEventHandlerFn
  onMouseDown?: LeafletMouseEventHandlerFn
  onMouseUp?: LeafletMouseEventHandlerFn
  onMouseOver?: LeafletMouseEventHandlerFn
  onMouseOut?: LeafletMouseEventHandlerFn
  onContextMenu?: LeafletMouseEventHandlerFn
}

type MarkerClusterControl = L.MarkerClusterGroupOptions & ClusterEvents & {
  children: React.ReactNode
}

const getPropsAndEvents = (props: MarkerClusterControl) => {
  let clusterProps: ClusterType = {}
  let clusterEvents: ClusterType = {}
  const { children, ...rest } = props
  
  // Splitting props and events to different objects
  Object.entries(rest).forEach(([propName, prop]) => {
  if (propName.startsWith('on')) {
    clusterEvents = { ...clusterEvents, [propName]: prop }
  } else {
    clusterProps = { ...clusterProps, [propName]: prop }
  }
  })
  
	return [clusterProps, clusterEvents]
}
  
const CreateMarkerCluster = (props: MarkerClusterControl, context: LeafletContextInterface) => {
	const [clusterProps, clusterEvents] = getPropsAndEvents(props)
	const clusterGroup = new L.MarkerClusterGroup(clusterProps)

	useEffect(() => {
		Object.entries(clusterEvents).forEach(([eventAsProp, callback]) => {
		const clusterEvent = `cluster${eventAsProp.substring(2).toLowerCase()}`
		clusterGroup.on(clusterEvent, callback)
		})
		return () => {
		Object.entries(clusterEvents).forEach(([eventAsProp]) => {
			const clusterEvent = `cluster${eventAsProp.substring(2).toLowerCase()}`
			clusterGroup.removeEventListener(clusterEvent)
		})
		}
	}, [clusterEvents, clusterGroup])

	return {
		instance: clusterGroup,
		context: { ...context, layerContainer: clusterGroup }
	}
}


const ReactLeafletMarkerClusterGroup = createPathComponent<L.MarkerClusterGroup, MarkerClusterControl>(
	CreateMarkerCluster
)

export default ReactLeafletMarkerClusterGroup
