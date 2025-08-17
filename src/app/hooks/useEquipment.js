import {EquipmentService} from '../../services/EquipmentService'
export function useEquipment(){return {
  getAll: EquipmentService.getAllEquipments,
  fetchAll: EquipmentService.fetchEquipments,
  getById: EquipmentService.getEquipmentById,
  fetchById: EquipmentService.fetchEquipmentById,
  getActive: EquipmentService.getActiveEquipments,
  getHistory: EquipmentService.getEquipmentHistory,
  create: EquipmentService.createEquipment,
  update: EquipmentService.updateEquipment,
  delete: EquipmentService.deleteEquipment,
  fetchComments: EquipmentService.fetchComments,
  addComment: EquipmentService.addComment,
  deleteComment: EquipmentService.deleteComment,
  getCleanlinessHistory: EquipmentService.getCleanlinessHistory,
  getConditionHistory: EquipmentService.getConditionHistory,
  getByStatus: EquipmentService.getEquipmentsByStatus,
  searchByIdentifyingNumber: EquipmentService.searchEquipmentsByIdentifyingNumber,
  getNeedingService: EquipmentService.getEquipmentsNeedingService,
  fetchIssues: EquipmentService.fetchIssues,
  addIssue: EquipmentService.addIssue,
  completeIssue: EquipmentService.completeIssue,
  deleteIssue: EquipmentService.deleteIssue
}}
export default useEquipment

