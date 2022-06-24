import { Feature } from 'geojson';
import { IDBConnection } from '../database/db';
import { IInsertSpatialTransform, SpatialRepository } from '../repositories/spatial-repository';
import { DBService } from './db-service';

export class SpatialService extends DBService {
  spatialRepository: SpatialRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.spatialRepository = new SpatialRepository(connection);
  }

  async insertSpatialTransform(
    spatialTransformDetails: IInsertSpatialTransform
  ): Promise<{ spatial_transform_id: number }> {
    return this.spatialRepository.insertSpatialTransform(spatialTransformDetails);
  }

  async getSpatialTransformBySpatialTransformId(spatialTransformId: number): Promise<{ transform: string }> {
    return this.spatialRepository.getSpatialTransformBySpatialTransformId(spatialTransformId);
  }

  async insertSpatialTransformSubmissionRecord(
    spatialTransformId: number,
    submissionSpatialComponentId: number
  ): Promise<{ spatial_transform_submission_id: number }> {
    return this.spatialRepository.insertSpatialTransformSubmissionRecord(
      spatialTransformId,
      submissionSpatialComponentId
    );
  }

  async runTransform(submissionId: number, spatialTransformId: number): Promise<any> {
    const spatialTransform = await this.getSpatialTransformBySpatialTransformId(spatialTransformId);

    console.log('spatialTransform', spatialTransform);
    console.log('submissionId', submissionId);

    const transformed = await this.spatialRepository.runSpatialTransformOnSubmissionId(
      submissionId,
      spatialTransform.transform
    );
    console.log('transformed', transformed);

    const response = this.spatialRepository.insertSubmissionSpatialComponent(submissionId, tempData);
    console.log('response', response);
  }
}

const tempData = [
  {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [125.6, 10.1, 125.6, 10.1, 125.6, 10.1]
    },
    properties: {
      type: 'Boundary',
      name: 'Crow Project',
      start_date: '',
      end_date: ''
    }
  } as unknown as Feature
];
//   {
//     type: 'Feature',
//     geometry: {
//       type: 'Point',
//       coordinates: [125.6, 10.1]
//     },
//     properties: {
//       type: 'Occurrence',
//       taxon: 'Moose',
//       sex: 'Male',
//       lifestage: 'Adult'
//     }
//   },
//   {
//     type: 'Feature',
//     geometry: {
//       type: 'Point',
//       coordinates: [125.6, 10.1]
//     },
//     properties: {
//       type: 'Occurrence',
//       taxon: 'Crow',
//       sex: 'Female',
//       lifestage: 'Adult'
//     }
//   },
//   {
//     type: 'Feature',
//     geometry: {
//       type: 'Line',
//       coordinates: [125.6, 10.1]
//     },
//     properties: {
//       type: 'SecondarySpatial',
//       sub_type: 'blocks'
//     }
//   },
//   {
//     type: 'Feature',
//     geometry: {
//       type: 'Polygon',
//       coordinates: [125.6, 10.1, 125.6, 10.1, 125.6, 10.1, 125.6, 10.1]
//     },
//     properties: {
//       type: 'Boundary',
//       name: 'Moose Project',
//       start_date: '',
//       end_date: ''
//     }
//   }
// ];
