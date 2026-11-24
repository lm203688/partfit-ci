Pod::Spec.new do |s|
  s.name           = 'PartFitOcr'
  s.version        = '1.0.0'
  s.summary        = 'On-device text recognition for model plates and filter labels'
  s.description    = 'Uses Vision to read text from a photo. Nothing leaves the device.'
  s.author         = 'PartFit'
  s.homepage       = 'https://partfit.app'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => 'https://github.com/partfit/partfit-ocr.git' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.source_files   = '**/*.{h,m,mm,swift}'
  s.dependency 'ExpoModulesCore'
end
