/**
 * Test suite for FlowDiagramComponent.
 * Tests the message flow visualization functionality including:
 * - Node positioning and layout
 * - Message flow rendering
 * - Service name resolution
 * - Flow updates
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatIconModule } from '@angular/material/icon';
import { FlowDiagramComponent } from './flow-diagram.component';
import { ServicesService } from '../../../services/services.service';
import { MessageFlow } from '../../../services/tracker.service';
import { ActionType } from '../../../services/websocket.service';

describe('FlowDiagramComponent', () => {
    let component: FlowDiagramComponent;
    let fixture: ComponentFixture<FlowDiagramComponent>;
    let mockServicesService: jasmine.SpyObj<ServicesService>;

    /**
     * Test setup before each test case.
     * Configures TestBed with required imports and service mocks.
     */
    beforeEach(async () => {
        mockServicesService = jasmine.createSpyObj('ServicesService', ['getService']);
        mockServicesService.getService.and.returnValue({
            name: 'Test Service',
            id: 'test-service',
            description: 'Test service description',
            status: 'connected',
            connectedAt: new Date(),
            lastHeartbeat: new Date()
        });

        await TestBed.configureTestingModule({
            imports: [
                NoopAnimationsModule,
                MatTooltipModule,
                MatIconModule,
                FlowDiagramComponent
            ],
            providers: [
                { provide: ServicesService, useValue: mockServicesService }
            ]
        }).compileComponents();

        fixture = TestBed.createComponent(FlowDiagramComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    /**
     * Test case: Component Creation
     * Verifies that the FlowDiagramComponent can be created successfully.
     */
    it('should create', () => {
        expect(component).toBeTruthy();
    });

    /**
     * Test case: Flow Update
     * Verifies that the component can update its visualization when a new flow is provided.
     */
    it('should update flow visualization', () => {
        const mockFlow: MessageFlow = {
            request: {
                serviceId: 'test-service',
                message: {
                    header: {
                        action: ActionType.REQUEST,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                timeout: 5000,
                receivedAt: new Date()
            },
            response: {
                target: {
                    serviceId: 'responder-service',
                    priority: 1
                },
                message: {
                    header: {
                        action: ActionType.RESPONSE,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                sentAt: new Date(),
                fromBroker: false
            },
            updateCount: 0
        };

        component.updateFlow(mockFlow);
        expect(component.flowData?.nodes.length).toBeGreaterThan(0);
        expect(component.flowData?.messages.length).toBeGreaterThan(0);
    });

    /**
     * Test case: Service Name Resolution
     * Verifies that service names are properly resolved using ServicesService.
     */
    it('should resolve service names', () => {
        const serviceId = 'test-service';
        const result = component.getServiceName(serviceId);
        expect(mockServicesService.getService).toHaveBeenCalledWith(serviceId);
        expect(result).toBe('Test Service');
    });

    /**
     * Test case: Node Layout
     * Verifies that nodes are positioned correctly in the diagram.
     */
    it('should position nodes correctly', () => {
        const mockFlow: MessageFlow = {
            request: {
                serviceId: 'originator',
                message: {
                    header: {
                        action: ActionType.REQUEST,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                timeout: 5000,
                receivedAt: new Date()
            },
            response: {
                target: {
                    serviceId: 'responder',
                    priority: 1
                },
                message: {
                    header: {
                        action: ActionType.RESPONSE,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                sentAt: new Date(),
                fromBroker: false
            },
            auditors: ['auditor1', 'auditor2'],
            updateCount: 0
        };

        component.updateFlow(mockFlow);

        // Check that nodes are positioned in a logical layout
        const originatorNode = component.flowData?.nodes.find(n => n.id === 'originator');
        const responderNode = component.flowData?.nodes.find(n => n.id === 'responder');
        const auditorNodes = component.flowData?.nodes.filter(n => n.type === 'auditor');

        expect(originatorNode).toBeTruthy();
        expect(responderNode).toBeTruthy();
        expect(auditorNodes?.length).toBe(2);

        // Originator should be on the left
        expect(originatorNode?.x).toBeLessThan(responderNode?.x || 0);
    });

    /**
     * Test case: Message Flow Rendering
     * Verifies that messages between nodes are properly rendered.
     */
    it('should render message flows', () => {
        const mockFlow: MessageFlow = {
            request: {
                serviceId: 'originator',
                message: {
                    header: {
                        action: ActionType.REQUEST,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                timeout: 5000,
                receivedAt: new Date()
            },
            response: {
                target: {
                    serviceId: 'responder',
                    priority: 1
                },
                message: {
                    header: {
                        action: ActionType.RESPONSE,
                        topic: 'test-topic',
                        version: '1.0',
                        requestId: 'test-request'
                    },
                    payload: {}
                },
                sentAt: new Date(),
                fromBroker: false
            },
            updateCount: 0
        };

        component.updateFlow(mockFlow);

        // Should have request and response messages (2 messages total)
        // 1. originator -> message-broker (request)
        // 2. responder -> message-broker (response)
        expect(component.flowData?.messages.length).toBe(4);

        // Check message directions
        const requestMessage = component.flowData?.messages.find(m => m.header.action === ActionType.REQUEST);
        const responseMessage = component.flowData?.messages.find(m => m.header.action === ActionType.RESPONSE);

        expect(requestMessage?.from).toBe('originator');
        expect(requestMessage?.to).toBe('message-broker');
        expect(responseMessage?.from).toBe('responder');
        expect(responseMessage?.to).toBe('message-broker');
    });
});