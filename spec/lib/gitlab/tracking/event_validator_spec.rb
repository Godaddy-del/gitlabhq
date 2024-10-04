# frozen_string_literal: true

require 'spec_helper'

RSpec.describe Gitlab::Tracking::EventValidator, feature_category: :service_ping do
  let(:event_name) { 'test_event' }
  let(:additional_properties) { { label: 'test_label', property: 'test_property', value: 1, lang: "eng" } }
  let(:kwargs) { { user: build(:user), project: build(:project) } }
  let(:event_definition) { instance_double(Gitlab::Tracking::EventDefinition) }

  subject(:validate) { described_class.new(event_name, additional_properties, kwargs).validate! }

  before do
    allow(Gitlab::Tracking::EventDefinition).to receive(:internal_event_exists?).and_return(true)
    allow(Gitlab::Tracking::EventDefinition).to receive(:find).and_return(event_definition)
    allow(event_definition).to receive(:to_h).and_return({ additional_properties: [:lang] })
  end

  describe '#validate!' do
    context 'when event exists and properties are valid' do
      it 'does not raise an error' do
        expect { validate }.not_to raise_error
      end
    end

    context 'when event does not exist' do
      before do
        allow(Gitlab::Tracking::EventDefinition).to receive(:internal_event_exists?).and_return(false)
      end

      it 'raises an UnknownEventError' do
        expect { validate }.to raise_error(Gitlab::Tracking::EventValidator::UnknownEventError)
      end
    end

    context 'when properties have invalid types' do
      [
        { user: 'invalid_user' },
        { project: 'invalid_project' },
        { namespace: 'invalid_namespace' }
      ].each do |invalid_property|
        context "when #{invalid_property.each_key.first} is invalid" do
          let(:kwargs) { invalid_property }

          it 'raises an InvalidPropertyTypeError' do
            property_name = invalid_property.each_key.first
            expect { validate }.to raise_error(Gitlab::Tracking::EventValidator::InvalidPropertyTypeError,
              /#{property_name} should be an instance of #{property_name.capitalize}/)
          end
        end
      end
    end

    context 'when a base additional property is invalid' do
      [
        { label: 123 },
        { value: 'test_value' },
        { property: true }
      ].each do |invalid_property|
        context "when #{invalid_property.each_key.first} is invalid" do
          let(:additional_properties) { invalid_property }

          it 'raises an InvalidPropertyTypeError' do
            property = invalid_property.each_key.first
            expected_type = described_class::BASE_ADDITIONAL_PROPERTIES[property]
            expect { validate }.to raise_error(Gitlab::Tracking::EventValidator::InvalidPropertyTypeError,
              /#{property} should be an instance of #{expected_type}/)
          end
        end
      end
    end

    context 'when custom additional properties are not defined in event definition' do
      let(:additional_properties) { { custom_property: 'value' } }

      it 'raises an InvalidPropertyError for unknown properties' do
        expect { validate }.to raise_error(Gitlab::Tracking::EventValidator::InvalidPropertyError,
          'Unknown additional property: custom_property')
      end
    end
  end
end
