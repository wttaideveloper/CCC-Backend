import { RoadMapDocument } from '../schemas/roadmap.schema';
import { RoadMapResponseDto, NestedRoadMapItemDto } from '../dto/roadmap.dto';

export const toRoadMapResponseDto = (doc: RoadMapDocument): RoadMapResponseDto => {

    return {
        _id: doc._id.toString(),
        name: doc.name,
        roadMapDetails: doc.roadMapDetails,
        description: doc.description,
        status: doc.status,
        duration: doc.duration,
        startDate: doc.startDate,
        endDate: doc.endDate,
        completedOn: doc.completedOn,
        imageUrl: doc.imageUrl,
        meetings: doc.meetings,
        haveNextedRoadMaps: doc.haveNextedRoadMaps,
        phase: doc.phase,
        extras: doc.extras,

        roadmaps: doc.roadmaps.map(item => ({
            _id: item._id?.toString(),
            name: item.name,
            roadMapDetails: item.roadMapDetails,
            description: item.description,
            status: item.status,
            duration: item.duration,
            startDate: item.startDate,
            endDate: item.endDate,
            completedOn: item.completedOn,
            imageUrl: item.imageUrl,
            meetings: item.meetings,
            extras: item.extras
        }) as NestedRoadMapItemDto),
        // createdAt: doc.createdAt,
        // updatedAt: doc.updatedAt,
    };
};